const express = require("express");
const dotenv = require("dotenv");
const session = require("express-session");
const flash = require("connect-flash");
const methodOverride = require("method-override");
const path = require("path");
const connectDB = require("./config/db");

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
    next();
});

// Routes
app.use("/auth", require("./routes/authRoutes"));
app.use("/events", require("./routes/eventRoutes"));

// Home redirect
app.get("/", (req, res) => {
    if (req.session.user) return res.redirect("/events");
    res.redirect("/auth/login");
});

// 404
app.use((req, res) => {
    res.status(404).render("404", { title: "Page Not Found" });
});

const startServer = async () => {
    try {
        await connectDB();
        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => console.log(`🚀 Campus Pulse running at http://localhost:${PORT}`));
    } catch (error) {
        console.error("Failed to start:", error);
        process.exit(1);
    }
};

startServer();
