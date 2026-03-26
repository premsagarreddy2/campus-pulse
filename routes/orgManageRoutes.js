const express = require("express");
const router = express.Router({ mergeParams: true });
const { protect, authorize } = require("../middleware/authMiddleware");
const {
    showManageOrg, addMember, removeMember, changeRole
} = require("../controllers/orgController");

// Org management routes (mounted at /:slug/manage)
router.get("/", protect, authorize("admin"), showManageOrg);
router.post("/add-member", protect, authorize("admin"), addMember);
router.post("/remove-member", protect, authorize("admin"), removeMember);
router.post("/change-role", protect, authorize("admin"), changeRole);

module.exports = router;
