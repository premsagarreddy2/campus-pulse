const express = require("express");
const router = express.Router({ mergeParams: true });
const upload = require("../config/upload");
const { protect, authorize, requireOrgMember } = require("../middleware/authMiddleware");
const {
    getEvents, getEventById, showCreateForm, createEvent,
    showEditForm, updateEvent, deleteEvent,
    registerForEvent, getMyEvents, getEventParticipants,
    showQRPage, markAttendanceByQR, manualMarkAttendance,
    showStudentQR, showScanPage, verifyStudentEntry,
    createPaymentOrder, verifyPayment
} = require("../controllers/eventController");

// IMPORTANT: specific routes before :id
router.get("/my-events", protect, requireOrgMember, authorize("student"), getMyEvents);
router.get("/new", protect, requireOrgMember, authorize("admin", "coordinator"), showCreateForm);

router.get("/", protect, requireOrgMember, getEvents);
router.post("/", protect, requireOrgMember, authorize("admin", "coordinator"), upload.single("image"), createEvent);

router.get("/:id", protect, requireOrgMember, getEventById);
router.get("/:id/edit", protect, requireOrgMember, authorize("admin", "coordinator"), showEditForm);
router.put("/:id", protect, requireOrgMember, authorize("admin", "coordinator"), upload.single("image"), updateEvent);
router.delete("/:id", protect, requireOrgMember, authorize("admin", "coordinator"), deleteEvent);

router.post("/:id/register", protect, requireOrgMember, authorize("student"), registerForEvent);
router.post("/:id/create-order", protect, requireOrgMember, authorize("student"), createPaymentOrder);
router.post("/:id/verify-payment", protect, requireOrgMember, authorize("student"), verifyPayment);
router.get("/:id/my-qr", protect, requireOrgMember, authorize("student"), showStudentQR);
router.get("/:id/participants", protect, requireOrgMember, authorize("admin", "coordinator"), getEventParticipants);
router.post("/:id/manual-attend", protect, requireOrgMember, authorize("admin", "coordinator"), manualMarkAttendance);
router.get("/:id/qr", protect, requireOrgMember, authorize("admin", "coordinator"), showQRPage);
router.get("/:id/scan", protect, requireOrgMember, authorize("admin", "coordinator"), showScanPage);
router.get("/:id/verify-entry/:token", protect, requireOrgMember, authorize("admin", "coordinator"), verifyStudentEntry);
router.get("/:id/attend/:token", protect, requireOrgMember, authorize("student"), markAttendanceByQR);

module.exports = router;
