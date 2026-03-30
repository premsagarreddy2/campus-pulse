const express = require("express");
const router = express.Router({ mergeParams: true });
const {
    showOrgLogin, showOrgRegister, loginOrgUser, registerOrgUser
} = require("../controllers/authController");

// Org-scoped auth routes (mounted at /:slug/auth)
router.get("/login", showOrgLogin);
router.post("/login", loginOrgUser);
router.get("/register", showOrgRegister);
router.post("/register", registerOrgUser);

module.exports = router;
