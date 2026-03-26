const Organization = require("../models/Organization");

// Reserved slugs that cannot be used as organization slugs
const RESERVED_SLUGS = new Set([
    "auth", "api", "admin", "create-organization", "my-organizations",
    "uploads", "css", "js", "images", "public", "static",
    "favicon.ico", "robots.txt", "sitemap.xml"
]);

/**
 * Middleware that resolves :slug param to an organization.
 * Sets req.org (the organization object) and req.userRole (user's role in this org).
 * Also sets res.locals.org and res.locals.basePath for views.
 */
const resolveOrg = async (req, res, next) => {
    try {
        const { slug } = req.params;

        if (!slug || RESERVED_SLUGS.has(slug)) {
            return next("route"); // Skip to next route handler
        }

        const org = await Organization.findOne({ slug })
            .populate("members.user", "name email");

        if (!org) {
            return res.status(404).render("404", {
                title: "Organization Not Found",
                message: `No organization found with slug "${slug}"`
            });
        }

        req.org = org;
        res.locals.org = org;
        res.locals.basePath = `/${org.slug}`;

        // Determine user's role within this organization
        if (req.session && req.session.user) {
            const membership = org.members.find(
                m => m.user._id.toString() === req.session.user._id ||
                     m.user.toString() === req.session.user._id
            );
            req.userRole = membership ? membership.role : null;
            res.locals.userRole = req.userRole;
        } else {
            req.userRole = null;
            res.locals.userRole = null;
        }

        next();
    } catch (err) {
        console.error("Org middleware error:", err);
        req.flash("error", "Failed to load organization");
        res.redirect("/");
    }
};

module.exports = { resolveOrg, RESERVED_SLUGS };
