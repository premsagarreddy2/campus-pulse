const express = require("express");
const router = express.Router();
const { showLogin, showRegister, loginUser, registerUser, logoutUser, showCreateUser, createUserByAdmin } = require("../controllers/authController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.get("/login", showLogin);
router.post("/login", loginUser);
router.get("/register", showRegister);
router.post("/register", registerUser);
router.get("/logout", logoutUser);
router.get("/admin/create-user", protect, authorize("admin"), showCreateUser);
router.post("/admin/create-user", protect, authorize("admin"), createUserByAdmin);

module.exports = router;
