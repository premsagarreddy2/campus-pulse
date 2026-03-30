const express = require("express");
const router = express.Router({ mergeParams: true });
const {
    showLogin, showRegister, loginUser, registerUser, logoutUser
} = require("../controllers/authController");

// Global auth routes (mounted at /auth)
router.get("/login", showLogin);
router.post("/login", loginUser);
router.get("/register", showRegister);
router.post("/register", registerUser);
router.get("/logout", logoutUser);

module.exports = router;
