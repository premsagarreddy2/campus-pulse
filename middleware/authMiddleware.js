// Protect: must be logged in (session-based)
const protect = (req, res, next) => {
    if (!req.session.user) {
        req.flash("error", "Please login to continue");
        // If we're inside an org context, redirect to org login
        if (req.org) {
            return res.redirect(`/${req.org.slug}/auth/login`);
        }
        return res.redirect("/auth/login");
    }
    // Attach user to req for convenience
    req.user = req.session.user;
    next();
};

// Role-based authorization (now checks org-scoped role via req.userRole)
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            req.flash("error", "Please login to continue");
            return res.redirect("/auth/login");
        }
        if (!req.userRole || !roles.includes(req.userRole)) {
            req.flash("error", "Access denied. Insufficient permissions in this organization.");
            if (req.org) {
                return res.redirect(`/${req.org.slug}/events`);
            }
            return res.redirect("/");
        }
        next();
    };
};

// Check org membership (user must be a member of the current org)
const requireOrgMember = (req, res, next) => {
    if (!req.userRole) {
        req.flash("error", "You are not a member of this organization. Please join first.");
        if (req.org) {
            return res.redirect(`/${req.org.slug}/auth/register`);
        }
        return res.redirect("/");
    }
    next();
};

module.exports = { protect, authorize, requireOrgMember };
