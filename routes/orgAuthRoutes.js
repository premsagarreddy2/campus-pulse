const express = require("express");
const router = express.Router({ mergeParams: true });
const {
    showOrgLogin, showOrgRegister, loginOrgUser, registerOrgUser,
    showOrgVerifyOtp, verifyOrgOtp
} = require("../controllers/authController");

// Org-scoped auth routes (mounted at /:slug/auth)
router.get("/login", showOrgLogin);
router.post("/login", loginOrgUser);
router.get("/register", showOrgRegister);
router.post("/register", registerOrgUser);
router.get("/verify-otp", showOrgVerifyOtp);
router.post("/verify-otp", verifyOrgOtp);

module.exports = router;
