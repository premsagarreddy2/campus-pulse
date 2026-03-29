const User = require("../models/User");
const Organization = require("../models/Organization");
const bcrypt = require("bcryptjs");
const sendEmail = require("../utils/sendEmail");

// GET /auth/login (global)
exports.showLogin = (req, res) => {
    if (req.session.user) return res.redirect("/my-organizations");
    res.render("auth/login", {
        title: "Login — Campus Pulse",
        orgSlug: null
    });
};

// GET /:slug/auth/login (org-scoped)
exports.showOrgLogin = (req, res) => {
    if (req.session.user) {
        // Check if already a member
        if (req.userRole) {
            return res.redirect(`/${req.org.slug}/events`);
        }
    }
    res.render("auth/login", {
        title: `Login — ${req.org.name}`,
        orgSlug: req.org.slug
    });
};

// GET /auth/register (global)
exports.showRegister = (req, res) => {
    if (req.session.user) return res.redirect("/my-organizations");
    res.render("auth/register", {
        title: "Register — Campus Pulse",
        orgSlug: null
    });
};

// GET /:slug/auth/register (org-scoped)
exports.showOrgRegister = (req, res) => {
    res.render("auth/register", {
        title: `Join ${req.org.name} — Campus Pulse`,
        orgSlug: req.org.slug
    });
};

// POST /auth/login (global)
exports.loginUser = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            req.flash("error", "Invalid email or password");
            return res.redirect("/auth/login");
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            req.flash("error", "Invalid email or password");
            return res.redirect("/auth/login");
        }

        if (!user.isVerified) {
            req.flash("error", "Your email is not verified. Please verify your account.");
            return res.redirect(`/auth/verify-otp?email=${encodeURIComponent(user.email)}`);
        }

        // Save user to session (no role here — roles are per-org)
        req.session.user = {
            _id: user._id.toString(),
            name: user.name,
            email: user.email
        };

        // Find user's organizations
        const orgs = await Organization.find({ "members.user": user._id });

        req.flash("success", `Welcome back, ${user.name}! 👋`);

        if (orgs.length === 1) {
            return res.redirect(`/${orgs[0].slug}/events`);
        } else if (orgs.length > 1) {
            return res.redirect("/my-organizations");
        } else {
            // No orgs — go to landing/create
            return res.redirect("/");
        }
    } catch (err) {
        req.flash("error", "Server error. Please try again.");
        res.redirect("/auth/login");
    }
};

// POST /:slug/auth/login (org-scoped)
exports.loginOrgUser = async (req, res) => {
    const { email, password } = req.body;
    const slug = req.org.slug;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            req.flash("error", "Invalid email or password");
            return res.redirect(`/${slug}/auth/login`);
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            req.flash("error", "Invalid email or password");
            return res.redirect(`/${slug}/auth/login`);
        }

        if (!user.isVerified) {
            req.flash("error", "Your email is not verified. Please verify your account.");
            return res.redirect(`/${slug}/auth/verify-otp?email=${encodeURIComponent(user.email)}`);
        }

        req.session.user = {
            _id: user._id.toString(),
            name: user.name,
            email: user.email
        };

        // Check membership
        const org = await Organization.findById(req.org._id);
        const isMember = org.members.some(m => m.user.toString() === user._id.toString());

        if (!isMember) {
            // Auto-join as student
            org.members.push({ user: user._id, role: "student" });
            await org.save();
            req.flash("success", `Welcome to ${org.name}! You've joined as a student. 🎓`);
        } else {
            req.flash("success", `Welcome back, ${user.name}! 👋`);
        }

        res.redirect(`/${slug}/events`);
    } catch (err) {
        req.flash("error", "Server error. Please try again.");
        res.redirect(`/${slug}/auth/login`);
    }
};

// POST /auth/register (global)
exports.registerUser = async (req, res) => {
    const { name, email, password, confirmPassword } = req.body;
    try {
        if (password !== confirmPassword) {
            req.flash("error", "Passwords do not match");
            return res.redirect("/auth/register");
        }

        let user = await User.findOne({ email });
        if (user) {
            if (user.isVerified) {
                req.flash("error", "Email already registered");
                return res.redirect("/auth/register");
            }
        }

        const hashed = await bcrypt.hash(password, 10);
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        if (user) {
            user.password = hashed;
            user.name = name;
            user.otp = otp;
            user.otpExpiresAt = otpExpiresAt;
            await user.save();
        } else {
            user = await User.create({ name, email, password: hashed, otp, otpExpiresAt, isVerified: false });
        }

        await sendEmail({
            email: user.email,
            subject: "Verify your email - Campus Pulse",
            html: `<h3>Welcome to Campus Pulse!</h3><p>Your OTP to verify your account is: <strong>${otp}</strong></p><p>It will expire in 10 minutes.</p>`
        });

        req.flash("success", "OTP sent to your email. Please verify.");
        res.redirect(`/auth/verify-otp?email=${encodeURIComponent(user.email)}`);
    } catch (err) {
        console.error("Register Error:", err);
        req.flash("error", "Registration failed. Try again.");
        res.redirect("/auth/register");
    }
};

// POST /:slug/auth/register (org-scoped — register and join org)
exports.registerOrgUser = async (req, res) => {
    const { name, email, password, confirmPassword } = req.body;
    const slug = req.org.slug;

    try {
        if (password !== confirmPassword) {
            req.flash("error", "Passwords do not match");
            return res.redirect(`/${slug}/auth/register`);
        }

        let user = await User.findOne({ email });

        if (user) {
            if (user.isVerified) {
                // User exists — check if already a member
                const org = await Organization.findById(req.org._id);
                const isMember = org.members.some(m => m.user.toString() === user._id.toString());
                if (isMember) {
                    req.flash("error", "This email is already registered and a member. Please login.");
                    return res.redirect(`/${slug}/auth/login`);
                }

                // Add to org as student
                org.members.push({ user: user._id, role: "student" });
                await org.save();

                req.session.user = {
                    _id: user._id.toString(),
                    name: user.name,
                    email: user.email
                };

                req.flash("success", `Welcome to ${org.name}! You've joined as a student. 🎓`);
                return res.redirect(`/${slug}/events`);
            }
        }

        const hashed = await bcrypt.hash(password, 10);
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        if (user) {
            user.password = hashed;
            user.name = name;
            user.otp = otp;
            user.otpExpiresAt = otpExpiresAt;
            await user.save();
        } else {
            // Create new user
            user = await User.create({ name, email, password: hashed, otp, otpExpiresAt, isVerified: false });
        }

        await sendEmail({
            email: user.email,
            subject: `Verify your email - ${req.org.name}`,
            html: `<h3>Welcome to ${req.org.name}!</h3><p>Your OTP to verify your account is: <strong>${otp}</strong></p><p>It will expire in 10 minutes.</p>`
        });

        // We don't join org here, wait until verify-otp.
        req.flash("success", "OTP sent to your email. Please verify.");
        res.redirect(`/${slug}/auth/verify-otp?email=${encodeURIComponent(user.email)}`);
    } catch (err) {
        console.error("Register Error:", err);
        req.flash("error", "Registration failed. Try again.");
        res.redirect(`/${slug}/auth/register`);
    }
};

// GET /auth/logout
exports.logoutUser = (req, res) => {
    req.session.destroy(() => {
        res.redirect("/auth/login");
    });
};

// GET /:slug/manage (admin only page — now part of orgController)
// Kept here for backwards compat: /auth/admin/create-user redirects
exports.showCreateUser = (req, res) => {
    if (req.org) {
        return res.redirect(`/${req.org.slug}/manage`);
    }
    res.redirect("/");
};

exports.createUserByAdmin = async (req, res) => {
    if (req.org) {
        return res.redirect(`/${req.org.slug}/manage`);
    }
    res.redirect("/");
};

// GET /auth/verify-otp (global)
exports.showVerifyOtp = (req, res) => {
    res.render("auth/verify-otp", {
        title: "Verify Email — Campus Pulse",
        orgSlug: null,
        email: req.query.email || ""
    });
};

// GET /:slug/auth/verify-otp (org-scoped)
exports.showOrgVerifyOtp = (req, res) => {
    res.render("auth/verify-otp", {
        title: `Verify Email — ${req.org.name}`,
        orgSlug: req.org.slug,
        email: req.query.email || ""
    });
};

// POST /auth/verify-otp
exports.verifyOtp = async (req, res) => {
    const { email, otp } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            req.flash("error", "User not found.");
            return res.redirect("/auth/register");
        }

        if (user.otp !== otp || user.otpExpiresAt < Date.now()) {
            req.flash("error", "Invalid or expired OTP.");
            return res.redirect(`/auth/verify-otp?email=${encodeURIComponent(email)}`);
        }

        user.isVerified = true;
        user.otp = undefined;
        user.otpExpiresAt = undefined;
        await user.save();

        req.session.user = {
            _id: user._id.toString(),
            name: user.name,
            email: user.email
        };

        req.flash("success", "Email verified successfully! Welcome 👋");
        res.redirect("/my-organizations");
    } catch (err) {
        console.error("Verify Error", err);
        req.flash("error", "Verification failed. Try again.");
        res.redirect(`/auth/verify-otp?email=${encodeURIComponent(email)}`);
    }
};

// POST /:slug/auth/verify-otp
exports.verifyOrgOtp = async (req, res) => {
    const { email, otp } = req.body;
    const slug = req.org.slug;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            req.flash("error", "User not found.");
            return res.redirect(`/${slug}/auth/register`);
        }

        if (user.otp !== otp || user.otpExpiresAt < Date.now()) {
            req.flash("error", "Invalid or expired OTP.");
            return res.redirect(`/${slug}/auth/verify-otp?email=${encodeURIComponent(email)}`);
        }

        user.isVerified = true;
        user.otp = undefined;
        user.otpExpiresAt = undefined;
        await user.save();

        // Log them in
        req.session.user = {
            _id: user._id.toString(),
            name: user.name,
            email: user.email
        };

        // Also add to org if not already a member
        const org = await Organization.findById(req.org._id);
        const isMember = org.members.some(m => m.user.toString() === user._id.toString());
        if (!isMember) {
            org.members.push({ user: user._id, role: "student" });
            await org.save();
        }

        req.flash("success", `Account verified and joined ${org.name}! 🎉`);
        res.redirect(`/${slug}/events`);
    } catch (err) {
        console.error("Verify Error", err);
        req.flash("error", "Verification failed. Try again.");
        res.redirect(`/${slug}/auth/verify-otp?email=${encodeURIComponent(email)}`);
    }
};
