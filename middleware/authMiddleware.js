// Protect: must be logged in (session-based)
const protect = (req, res, next) => {
    if (!req.session.user) {
        req.flash("error", "Please login to continue");
        return res.redirect("/auth/login");
    }
    // Attach user to req for convenience
    req.user = req.session.user;
    next();
};

// Role-based authorization
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            req.flash("error", "Access denied. Insufficient permissions.");
            return res.redirect("/events");
        }
        next();
    };
};

module.exports = { protect, authorize };
