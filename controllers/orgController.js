const Organization = require("../models/Organization");
const { RESERVED_SLUGS } = require("../middleware/orgMiddleware");

// Helper: generate slug from name
const generateSlug = (name) => {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
};

// GET /create-organization
exports.showCreateOrg = (req, res) => {
    if (!req.session.user) {
        req.flash("error", "Please login to create an organization");
        return res.redirect("/auth/login");
    }
    res.render("create-org", { title: "Create Organization — Campus Pulse" });
};

// POST /create-organization
exports.createOrg = async (req, res) => {
    try {
        if (!req.session.user) {
            req.flash("error", "Please login first");
            return res.redirect("/auth/login");
        }

        const { name, description, slug: customSlug } = req.body;

        if (!name || !name.trim()) {
            req.flash("error", "Organization name is required");
            return res.redirect("/create-organization");
        }

        // Use custom slug or generate from name
        let slug = customSlug ? generateSlug(customSlug) : generateSlug(name);

        if (!slug) {
            req.flash("error", "Could not generate a valid URL slug from that name");
            return res.redirect("/create-organization");
        }

        // Check reserved slugs
        if (RESERVED_SLUGS.has(slug)) {
            req.flash("error", `"${slug}" is reserved and cannot be used as an organization slug`);
            return res.redirect("/create-organization");
        }

        // Check uniqueness
        const existing = await Organization.findOne({ slug });
        if (existing) {
            req.flash("error", `Slug "${slug}" is already taken. Try a different name or custom slug.`);
            return res.redirect("/create-organization");
        }

        const org = await Organization.create({
            name: name.trim(),
            slug,
            description: description ? description.trim() : "",
            logo: req.file ? req.file.path : null,
            createdBy: req.session.user._id,
            members: [{
                user: req.session.user._id,
                role: "admin"
            }]
        });

        req.flash("success", `🎉 Organization "${org.name}" created! You are the admin.`);
        res.redirect(`/${org.slug}/events`);
    } catch (err) {
        console.error("Create org error:", err);
        req.flash("error", "Failed to create organization: " + err.message);
        res.redirect("/create-organization");
    }
};

// GET /my-organizations
exports.myOrganizations = async (req, res) => {
    try {
        if (!req.session.user) {
            req.flash("error", "Please login first");
            return res.redirect("/auth/login");
        }

        const orgs = await Organization.find({ "members.user": req.session.user._id })
            .populate("createdBy", "name")
            .sort({ updatedAt: -1 });

        // Enrich with user's role in each org
        const enriched = orgs.map(org => {
            const membership = org.members.find(m => m.user.toString() === req.session.user._id);
            return {
                ...org.toObject(),
                userRole: membership ? membership.role : null,
                memberCount: org.members.length
            };
        });

        res.render("org-picker", {
            title: "My Organizations — Campus Pulse",
            organizations: enriched
        });
    } catch (err) {
        console.error("My orgs error:", err);
        req.flash("error", "Failed to load organizations");
        res.redirect("/");
    }
};

// GET / — Landing page
exports.landingPage = async (req, res) => {
    try {
        // If user logged in and belongs to only one org, redirect directly
        if (req.session.user) {
            const orgs = await Organization.find({ "members.user": req.session.user._id });
            if (orgs.length === 1) {
                return res.redirect(`/${orgs[0].slug}/events`);
            }
            if (orgs.length > 1) {
                return res.redirect("/my-organizations");
            }
        }

        // Show landing page with list of public organizations
        const publicOrgs = await Organization.find()
            .sort({ createdAt: -1 })
            .limit(12);

        const orgsEnriched = publicOrgs.map(org => ({
            ...org.toObject(),
            memberCount: org.members.length
        }));

        res.render("landing", {
            title: "Campus Pulse — Event Management Platform",
            organizations: orgsEnriched
        });
    } catch (err) {
        console.error("Landing error:", err);
        res.render("landing", {
            title: "Campus Pulse — Event Management Platform",
            organizations: []
        });
    }
};

// GET /:slug/manage — Org management page (admin only)
exports.showManageOrg = async (req, res) => {
    try {
        const org = await Organization.findById(req.org._id)
            .populate("members.user", "name email")
            .populate("createdBy", "name email");

        res.render("manage-org", {
            title: `Manage — ${org.name}`,
            orgData: org.toObject()
        });
    } catch (err) {
        req.flash("error", "Failed to load management page");
        res.redirect(`/${req.org.slug}/events`);
    }
};

// POST /:slug/manage/add-member
exports.addMember = async (req, res) => {
    try {
        const { email, role } = req.body;
        const User = require("../models/User");
        const user = await User.findOne({ email });

        if (!user) {
            req.flash("error", "No user found with that email. They must register on the platform first.");
            return res.redirect(`/${req.org.slug}/manage`);
        }

        const org = await Organization.findById(req.org._id);
        const alreadyMember = org.members.some(m => m.user.toString() === user._id.toString());
        if (alreadyMember) {
            req.flash("error", "User is already a member of this organization");
            return res.redirect(`/${req.org.slug}/manage`);
        }

        org.members.push({
            user: user._id,
            role: ["admin", "coordinator", "student"].includes(role) ? role : "student"
        });
        await org.save();

        req.flash("success", `✅ ${user.name} added as ${role}`);
        res.redirect(`/${req.org.slug}/manage`);
    } catch (err) {
        req.flash("error", "Failed to add member");
        res.redirect(`/${req.org.slug}/manage`);
    }
};

// POST /:slug/manage/remove-member
exports.removeMember = async (req, res) => {
    try {
        const { userId } = req.body;
        const org = await Organization.findById(req.org._id);

        // Can't remove the creator
        if (org.createdBy.toString() === userId) {
            req.flash("error", "Cannot remove the organization creator");
            return res.redirect(`/${req.org.slug}/manage`);
        }

        org.members = org.members.filter(m => m.user.toString() !== userId);
        await org.save();

        req.flash("success", "Member removed");
        res.redirect(`/${req.org.slug}/manage`);
    } catch (err) {
        req.flash("error", "Failed to remove member");
        res.redirect(`/${req.org.slug}/manage`);
    }
};

// POST /:slug/manage/change-role
exports.changeRole = async (req, res) => {
    try {
        const { userId, role } = req.body;
        const org = await Organization.findById(req.org._id);

        const member = org.members.find(m => m.user.toString() === userId);
        if (!member) {
            req.flash("error", "Member not found");
            return res.redirect(`/${req.org.slug}/manage`);
        }

        if (!["admin", "coordinator", "student"].includes(role)) {
            req.flash("error", "Invalid role");
            return res.redirect(`/${req.org.slug}/manage`);
        }

        member.role = role;
        await org.save();

        req.flash("success", `Role updated to ${role}`);
        res.redirect(`/${req.org.slug}/manage`);
    } catch (err) {
        req.flash("error", "Failed to change role");
        res.redirect(`/${req.org.slug}/manage`);
    }
};

// POST /:slug/manage/razorpay-config
exports.updateRazorpayConfig = async (req, res) => {
    try {
        const { keyId, keySecret } = req.body;
        const org = await Organization.findById(req.org._id);

        org.razorpayKeyId = keyId ? keyId.trim() : null;
        org.razorpayKeySecret = keySecret ? keySecret.trim() : null;

        await org.save();

        req.flash("success", "✅ Razorpay configuration updated");
        res.redirect(`/${req.org.slug}/manage`);
    } catch (err) {
        req.flash("error", "Failed to save Razorpay configuration");
        res.redirect(`/${req.org.slug}/manage`);
    }
};
