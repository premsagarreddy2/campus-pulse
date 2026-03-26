const express = require("express");
const router = express.Router();
const upload = require("../config/upload");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
    landingPage, showCreateOrg, createOrg, myOrganizations,
    showManageOrg, addMember, removeMember, changeRole
} = require("../controllers/orgController");

// Platform-level routes (no slug)
router.get("/", landingPage);
router.get("/create-organization", showCreateOrg);
router.post("/create-organization", upload.single("logo"), createOrg);
router.get("/my-organizations", myOrganizations);

module.exports = router;
