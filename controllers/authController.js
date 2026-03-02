const User = require("../models/User");
const bcrypt = require("bcryptjs");

// GET /auth/login
exports.showLogin = (req, res) => {
    if (req.session.user) return res.redirect("/events");
    res.render("auth/login", { title: "Login — Campus Pulse" });
};

// GET /auth/register
exports.showRegister = (req, res) => {
    if (req.session.user) return res.redirect("/events");
    res.render("auth/register", { title: "Register — Campus Pulse" });
};

// POST /auth/login
exports.loginUser = async (req, res) => {
    const { email, password, role } = req.body;
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

        if (role && user.role !== role) {
            req.flash("error", "Role mismatch. Check your selected role.");
            return res.redirect("/auth/login");
        }

        // Save user to session
        req.session.user = {
            _id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role
        };

        req.flash("success", `Welcome back, ${user.name}! 👋`);
        res.redirect("/events");
    } catch (err) {
        req.flash("error", "Server error. Please try again.");
        res.redirect("/auth/login");
    }
};

// POST /auth/register
exports.registerUser = async (req, res) => {
    const { name, email, password, confirmPassword } = req.body;
    try {
        if (password !== confirmPassword) {
            req.flash("error", "Passwords do not match");
            return res.redirect("/auth/register");
        }

        const exists = await User.findOne({ email });
        if (exists) {
            req.flash("error", "Email already registered");
            return res.redirect("/auth/register");
        }

        const hashed = await bcrypt.hash(password, 10);
        const user = await User.create({ name, email, password: hashed, role: "student" });

        // req.session.user = {
        //     _id: user._id.toString(),
        //     name: user.name,
        //     email: user.email,
        //     role: user.role
        // };

        req.flash("success", `Account created! Welcome, ${user.name} 🎉`);
        res.redirect("/auth/login");
    } catch (err) {
        req.flash("error", "Registration failed. Try again.");
        res.redirect("/auth/register");
    }
};

// GET /auth/logout
exports.logoutUser = (req, res) => {
    req.session.destroy(() => {
        res.redirect("/auth/login");
    });
};

// GET /auth/admin/create-user  (admin only page)
exports.showCreateUser = (req, res) => {
    res.render("auth/create-user", { title: "Create User — Admin" });
};

// POST /auth/admin/create-user
exports.createUserByAdmin = async (req, res) => {
    const { name, email, password, role } = req.body;
    try {
        if (!["coordinator", "admin"].includes(role)) {
            req.flash("error", "Invalid role selected");
            return res.redirect("/auth/admin/create-user");
        }
        const exists = await User.findOne({ email });
        if (exists) {
            req.flash("error", "Email already exists");
            return res.redirect("/auth/admin/create-user");
        }
        const hashed = await bcrypt.hash(password, 10);
        await User.create({ name, email, password: hashed, role });
        req.flash("success", `${role} account created for ${name}`);
        res.redirect("/auth/admin/create-user");
    } catch (err) {
        req.flash("error", "Failed to create user");
        res.redirect("/auth/admin/create-user");
    }
};
