const dns = require('dns');
dns.setDefaultResultOrder('ipv4first'); // Fix for Render ENETUNREACH on IPv6

const express = require("express");
const dotenv = require("dotenv");
const session = require("express-session");
const flash = require("connect-flash");
const methodOverride = require("method-override");
const path = require("path");
const connectDB = require("./config/db");
const { resolveOrg } = require("./middleware/orgMiddleware");

dotenv.config();

const app = express();

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Static files
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));

// Session
app.use(session({
    secret: process.env.JWT_SECRET || "campuspulsesecret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 day
}));

// Flash messages
app.use(flash());

// Global template variables
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    // Default: no org context (set by orgMiddleware when inside /:slug)
    res.locals.org = null;
    res.locals.basePath = "";
    res.locals.userRole = null;
    next();
});

// ====== FIXED ROUTES (no slug — registered first to avoid collisions) ======
app.use("/auth", require("./routes/authRoutes"));
app.use("/", require("./routes/orgRoutes")); // handles /, /create-organization, /my-organizations

// ====== SLUG-SCOPED ROUTES (/:slug) ======
app.use("/:slug/auth", resolveOrg, require("./routes/orgAuthRoutes"));
app.use("/:slug/events", resolveOrg, require("./routes/eventRoutes"));
app.use("/:slug/manage", resolveOrg, require("./routes/orgManageRoutes"));

// /:slug root — redirect to events dashboard
app.get("/:slug", resolveOrg, (req, res) => {
    if (req.org) {
        return res.redirect(`/${req.org.slug}/events`);
    }
    res.status(404).render("404", { title: "Page Not Found" });
});

// 404
app.use((req, res) => {
    res.status(404).render("404", { title: "Page Not Found" });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error("Express Error:", err);
    res.status(500).send(`<h2>Internal Server Error</h2><p>${err.message}</p>`);
});

const startServer = async () => {
    try {
        await connectDB();
        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => {
            console.log(`🚀 Campus Pulse running at http://localhost:${PORT}`);
            require("./jobs/cron");
        });
    } catch (error) {
        console.error("Failed to start:", error);
        process.exit(1);
    }
};

startServer();
