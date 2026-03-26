const express = require("express");
const router = express.Router({ mergeParams: true });
const {
    showLogin, showRegister, loginUser, registerUser, logoutUser,
    showOrgLogin, showOrgRegister, loginOrgUser, registerOrgUser,
    showCreateUser, createUserByAdmin
} = require("../controllers/authController");
const { protect, authorize } = require("../middleware/authMiddleware");

// Global auth routes (mounted at /auth)
router.get("/login", showLogin);
router.post("/login", loginUser);
router.get("/register", showRegister);
router.post("/register", registerUser);
router.get("/logout", logoutUser);

// Legacy route redirects
router.get("/admin/create-user", protect, showCreateUser);
router.post("/admin/create-user", protect, createUserByAdmin);

module.exports = router;
