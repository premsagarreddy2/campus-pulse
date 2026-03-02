const express = require("express");
const router = express.Router();
const upload = require("../config/upload");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
    getEvents, getEventById, showCreateForm, createEvent,
    showEditForm, updateEvent, deleteEvent,
    registerForEvent, getMyEvents, getEventParticipants,
    showQRPage, markAttendanceByQR, manualMarkAttendance,
    showStudentQR, showScanPage, verifyStudentEntry
} = require("../controllers/eventController");

// IMPORTANT: specific routes before :id
router.get("/my-events", protect, authorize("student"), getMyEvents);
router.get("/new", protect, authorize("admin", "coordinator"), showCreateForm);

router.get("/", protect, getEvents);
router.post("/", protect, authorize("admin", "coordinator"), upload.single("image"), createEvent);

router.get("/:id", protect, getEventById);
router.get("/:id/edit", protect, authorize("admin", "coordinator"), showEditForm);
router.put("/:id", protect, authorize("admin", "coordinator"), upload.single("image"), updateEvent);
router.delete("/:id", protect, authorize("admin", "coordinator"), deleteEvent);

router.post("/:id/register", protect, authorize("student"), registerForEvent);
router.get("/:id/my-qr", protect, authorize("student"), showStudentQR);
router.get("/:id/participants", protect, authorize("admin", "coordinator"), getEventParticipants);
router.post("/:id/manual-attend", protect, authorize("admin", "coordinator"), manualMarkAttendance);
router.get("/:id/qr", protect, authorize("admin", "coordinator"), showQRPage);
router.get("/:id/scan", protect, authorize("admin", "coordinator"), showScanPage);
router.get("/:id/verify-entry/:token", protect, authorize("admin", "coordinator"), verifyStudentEntry);
router.get("/:id/attend/:token", protect, authorize("student"), markAttendanceByQR);

module.exports = router;
