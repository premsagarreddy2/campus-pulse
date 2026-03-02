const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    markedAt: { type: Date, default: Date.now },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
});

const eventSchema = new mongoose.Schema(
    {
        title: { type: String, required: true },
        description: { type: String, required: true },
        date: { type: Date, required: true },
        venue: { type: String, required: true },
        image: { type: String },
        durationHours: { type: Number, default: 2 },

        // Event Category
        category: {
            type: String,
            enum: ["Technical", "Non-Technical", "Sports", "Cultural", "Workshop", "Other"],
            default: "Other",
            required: true
        },

        // Max seats (0 = unlimited)
        maxSeats: { type: Number, default: 0 },

        // Per-student QR tokens: { studentId: qrToken }
        studentQRs: {
            type: Map,
            of: String,
            default: {}
        },

        // QR Token (unique secret per event for attendance scanning)
        qrToken: { type: String, unique: true, sparse: true },

        // Attendance list (marked via QR scan)
        attendance: [attendanceSchema],

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        registeredStudents: [
            { type: mongoose.Schema.Types.ObjectId, ref: "User" }
        ],
    },
    { timestamps: true }
);

module.exports = mongoose.model("Event", eventSchema);
