const Event = require("../models/Event");
const crypto = require("crypto");
const QRCode = require("qrcode");

const CATEGORIES = ["Technical", "Non-Technical", "Sports", "Cultural", "Workshop", "Other"];
const CAT_EMOJI = { Technical: "🖥", "Non-Technical": "🎭", Sports: "⚽", Cultural: "🎨", Workshop: "🔧", Other: "📌" };

const getStatus = (event) => {
    const now = new Date();
    const start = new Date(event.date);
    const end = new Date(start);
    end.setHours(start.getHours() + (event.durationHours || 2));
    if (now < start) return "Upcoming";
    if (now >= start && now <= end) return "Ongoing";
    return "Completed";
};

// GET /events  — dashboard
exports.getEvents = async (req, res) => {
    try {
        const { search = "", status = "All", category = "All", page = 1 } = req.query;
        const limit = 9;

        let query = {};
        if (search) query.title = { $regex: search, $options: "i" };
        if (category !== "All") query.category = category;

        const allEvents = await Event.find(query)
            .populate("createdBy", "name email")
            .sort({ date: 1 });

        let events = allEvents.map(e => ({
            ...e.toObject(),
            status: getStatus(e),
            seatsLeft: e.maxSeats > 0 ? e.maxSeats - e.registeredStudents.length : null,
            seatsPct: e.maxSeats > 0 ? Math.round((e.registeredStudents.length / e.maxSeats) * 100) : 0,
            isFull: e.maxSeats > 0 && e.registeredStudents.length >= e.maxSeats,
            catEmoji: CAT_EMOJI[e.category] || "📌"
        }));

        if (status !== "All") events = events.filter(e => e.status === status);

        let myRegisteredIds = new Set();
        if (req.user && req.user.role === "student") {
            const mine = await Event.find({ registeredStudents: req.user._id }, "_id");
            myRegisteredIds = new Set(mine.map(e => e._id.toString()));
        }

        const total = events.length;
        const pages = Math.ceil(total / limit) || 1;
        const currentPage = parseInt(page);
        const paginatedEvents = events.slice((currentPage - 1) * limit, currentPage * limit);

        res.render("events/dashboard", {
            title: "Dashboard — Campus Pulse",
            events: paginatedEvents,
            myRegisteredIds,
            search, status, category,
            categories: CATEGORIES,
            currentPage, pages, total
        });
    } catch (err) {
        req.flash("error", "Failed to load events");
        res.redirect("/");
    }
};

// GET /events/:id  — single event detail
exports.getEventById = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate("createdBy", "name email role")
            .populate("registeredStudents", "name email");

        if (!event) { req.flash("error", "Event not found"); return res.redirect("/events"); }

        const status = getStatus(event);
        const isRegistered = req.user
            ? event.registeredStudents.some(s => s._id.toString() === req.user._id)
            : false;

        res.render("events/detail", {
            title: `${event.title} — Campus Pulse`,
            event: { ...event.toObject(), status, catEmoji: CAT_EMOJI[event.category] || "📌" },
            isRegistered,
            categories: CATEGORIES
        });
    } catch (err) {
        req.flash("error", "Event not found");
        res.redirect("/events");
    }
};

// GET /events/new  — create form
exports.showCreateForm = (req, res) => {
    res.render("events/form", {
        title: "Create Event — Campus Pulse",
        event: null,
        categories: CATEGORIES,
        formAction: "/events",
        formMethod: "POST"
    });
};

// POST /events  — create
exports.createEvent = async (req, res) => {
    try {
        const { title, description, date, venue, durationHours, category, maxSeats } = req.body;
        const qrToken = crypto.randomBytes(32).toString("hex");

        await Event.create({
            title, description, date, venue,
            durationHours: durationHours || 2,
            category: category || "Other",
            maxSeats: parseInt(maxSeats) || 0,
            qrToken,
            image: req.file ? `/uploads/${req.file.filename}` : null,
            createdBy: req.user._id
        });

        req.flash("success", "Event created successfully! 🎉");
        res.redirect("/events");
    } catch (err) {
        req.flash("error", "Failed to create event: " + err.message);
        res.redirect("/events/new");
    }
};

// GET /events/:id/edit
exports.showEditForm = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) { req.flash("error", "Event not found"); return res.redirect("/events"); }

        if (req.user.role !== "admin" && event.createdBy.toString() !== req.user._id) {
            req.flash("error", "Not authorized to edit this event");
            return res.redirect("/events");
        }

        res.render("events/form", {
            title: "Edit Event — Campus Pulse",
            event: event.toObject(),
            categories: CATEGORIES,
            formAction: `/events/${event._id}?_method=PUT`,
            formMethod: "POST"
        });
    } catch (err) {
        req.flash("error", "Event not found");
        res.redirect("/events");
    }
};

// PUT /events/:id
exports.updateEvent = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) { req.flash("error", "Event not found"); return res.redirect("/events"); }

        if (req.user.role !== "admin" && event.createdBy.toString() !== req.user._id) {
            req.flash("error", "Not authorized");
            return res.redirect("/events");
        }

        const { title, description, date, venue, category, maxSeats, durationHours } = req.body;
        event.title = title || event.title;
        event.description = description || event.description;
        event.date = date || event.date;
        event.venue = venue || event.venue;
        event.category = category || event.category;
        event.maxSeats = parseInt(maxSeats) >= 0 ? parseInt(maxSeats) : event.maxSeats;
        event.durationHours = durationHours || event.durationHours;
        if (req.file) event.image = `/uploads/${req.file.filename}`;

        await event.save();
        req.flash("success", "Event updated ✅");
        res.redirect(`/events/${event._id}`);
    } catch (err) {
        req.flash("error", "Update failed");
        res.redirect("/events");
    }
};

// DELETE /events/:id
exports.deleteEvent = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) { req.flash("error", "Event not found"); return res.redirect("/events"); }

        if (req.user.role !== "admin" && event.createdBy.toString() !== req.user._id) {
            req.flash("error", "Not authorized");
            return res.redirect("/events");
        }

        await event.deleteOne();
        req.flash("success", "Event deleted 🗑️");
        res.redirect("/events");
    } catch (err) {
        req.flash("error", "Delete failed");
        res.redirect("/events");
    }
};

// POST /events/:id/register
exports.registerForEvent = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) { req.flash("error", "Event not found"); return res.redirect("/events"); }

        // Check event hasn't completely passed
        const now = new Date();
        const eventEnd = new Date(event.date);
        eventEnd.setHours(eventEnd.getHours() + (event.durationHours || 2));
        if (now > eventEnd) {
            req.flash("error", "Registration closed — event has ended");
            return res.redirect(`/events/${req.params.id}`);
        }

        if (event.registeredStudents.some(s => s.toString() === req.user._id)) {
            req.flash("error", "You are already registered");
            return res.redirect(`/events/${req.params.id}`);
        }

        if (event.maxSeats > 0 && event.registeredStudents.length >= event.maxSeats) {
            req.flash("error", "This event is full!");
            return res.redirect(`/events/${req.params.id}`);
        }

        // Add student and generate their personal QR token
        event.registeredStudents.push(req.user._id);
        const studentQRToken = crypto.randomBytes(32).toString("hex");
        event.studentQRs.set(req.user._id.toString(), studentQRToken);
        await event.save();

        req.flash("success", "Registered successfully! 🎉 View your entry QR in My Events.");
        res.redirect(`/events/${req.params.id}`);
    } catch (err) {
        req.flash("error", "Registration failed: " + err.message);
        res.redirect("/events");
    }
};

// GET /events/my-events
exports.getMyEvents = async (req, res) => {
    try {
        const events = await Event.find({ registeredStudents: req.user._id })
            .populate("createdBy", "name");

        const enriched = events.map(e => ({
            ...e.toObject(),
            status: getStatus(e),
            hasAttended: e.attendance.some(a => a.student.toString() === req.user._id),
            catEmoji: CAT_EMOJI[e.category] || "📌"
        }));

        const stats = {
            total: enriched.length,
            upcoming: enriched.filter(e => e.status === "Upcoming").length,
            attended: enriched.filter(e => e.hasAttended).length
        };

        res.render("events/my-events", {
            title: "My Events — Campus Pulse",
            events: enriched,
            stats
        });
    } catch (err) {
        req.flash("error", "Failed to load your events");
        res.redirect("/events");
    }
};

// GET /events/:id/participants  (admin/coordinator)
exports.getEventParticipants = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate("registeredStudents", "name email")
            .populate("attendance.student", "name email")
            .populate("createdBy", "name");

        if (!event) { req.flash("error", "Event not found"); return res.redirect("/events"); }

        const attendedIds = new Set(event.attendance.map(a => a.student._id.toString()));

        const participants = event.registeredStudents.map(s => ({
            ...s.toObject(),
            attended: attendedIds.has(s._id.toString())
        }));

        res.render("events/participants", {
            title: `Participants — ${event.title}`,
            event: { ...event.toObject(), status: getStatus(event) },
            participants,
            totalAttended: event.attendance.length
        });
    } catch (err) {
        req.flash("error", "Failed to load participants");
        res.redirect("/events");
    }
};

// GET /events/:id/qr  — admin shows event attendance QR (students scan this to self-mark)
exports.showQRPage = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) { req.flash("error", "Event not found"); return res.redirect("/events"); }

        if (!event.qrToken) {
            event.qrToken = crypto.randomBytes(32).toString("hex");
            await event.save();
        }

        const qrUrl = `${req.protocol}://${req.get("host")}/events/${event._id}/attend/${event.qrToken}`;

        // Generate server-side QR (no CDN dependency)
        const qrDataURL = await QRCode.toDataURL(qrUrl, {
            width: 280, margin: 2,
            color: { dark: "#000000", light: "#ffffff" }
        });

        res.render("events/qr", {
            title: `QR Attendance — ${event.title}`,
            event: event.toObject(),
            qrUrl,
            qrDataURL
        });
    } catch (err) {
        req.flash("error", "Failed to generate QR");
        res.redirect("/events");
    }
};

// GET /events/:id/scan  — admin/coordinator scan page
exports.showScanPage = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) { req.flash("error", "Event not found"); return res.redirect("/events"); }

        res.render("events/scan-entry", {
            title: `Scan Entry — ${event.title}`,
            event: event.toObject()
        });
    } catch (err) {
        req.flash("error", "Failed to load scan page");
        res.redirect("/events");
    }
};

// GET /events/:id/my-qr  — student views their personal entry QR
exports.showStudentQR = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) { req.flash("error", "Event not found"); return res.redirect("/events/my-events"); }

        const isRegistered = event.registeredStudents.some(s => s.toString() === req.user._id);
        if (!isRegistered) {
            req.flash("error", "You are not registered for this event");
            return res.redirect("/events/my-events");
        }

        // Get or generate student's unique QR token
        let qrToken = event.studentQRs.get(req.user._id.toString());
        if (!qrToken) {
            qrToken = crypto.randomBytes(32).toString("hex");
            event.studentQRs.set(req.user._id.toString(), qrToken);
            await event.save();
        }

        const verifyUrl = `${req.protocol}://${req.get("host")}/events/${event._id}/verify-entry/${qrToken}`;

        // Generate server-side QR image (no CDN needed)
        const qrDataURL = await QRCode.toDataURL(verifyUrl, {
            width: 280, margin: 2,
            color: { dark: "#000000", light: "#ffffff" }
        });

        res.render("events/student-qr", {
            title: `My Entry QR — ${event.title}`,
            event: event.toObject(),
            qrDataURL
        });
    } catch (err) {
        req.flash("error", "Failed to generate QR: " + err.message);
        res.redirect("/events/my-events");
    }
};

// GET /events/:id/attend/:token  — student self-marks via event QR
exports.markAttendanceByQR = async (req, res) => {
    try {
        const { id, token } = req.params;
        const event = await Event.findById(id);

        if (!event || event.qrToken !== token) {
            req.flash("error", "Invalid QR code");
            return res.redirect("/events");
        }

        const now = new Date();
        const start = new Date(event.date);
        const end = new Date(start);
        end.setHours(start.getHours() + (event.durationHours || 2) + 2);

        if (now < start) { req.flash("error", "Event hasn't started yet"); return res.redirect("/events"); }
        if (now > end) { req.flash("error", "Attendance window has closed"); return res.redirect("/events"); }

        if (!event.registeredStudents.some(s => s.toString() === req.user._id)) {
            req.flash("error", "You are not registered for this event");
            return res.redirect("/events");
        }

        if (event.attendance.some(a => a.student.toString() === req.user._id)) {
            req.flash("success", "Attendance already marked ✅");
            return res.redirect("/events/my-events");
        }

        event.attendance.push({ student: req.user._id });
        await event.save();
        req.flash("success", `Attendance marked for "${event.title}" 🎉`);
        res.redirect("/events/my-events");
    } catch (err) {
        req.flash("error", "Failed to mark attendance");
        res.redirect("/events");
    }
};

// POST /events/:id/manual-attend  (admin/coordinator)
exports.manualMarkAttendance = async (req, res) => {
    try {
        const { studentId } = req.body;
        const event = await Event.findById(req.params.id);
        if (!event) { req.flash("error", "Event not found"); return res.redirect("/events"); }

        if (event.attendance.some(a => a.student.toString() === studentId)) {
            req.flash("error", "Attendance already marked for this student");
        } else {
            event.attendance.push({ student: studentId, markedBy: req.user._id });
            await event.save();
            req.flash("success", "Attendance marked ✅");
        }

        res.redirect(`/events/${req.params.id}/participants`);
    } catch (err) {
        req.flash("error", "Failed to mark attendance");
        res.redirect("/events");
    }
};

// GET /events/:id/verify-entry/:token  — admin scans student QR
exports.verifyStudentEntry = async (req, res) => {
    try {
        const { id, token } = req.params;
        const event = await Event.findById(id).populate("registeredStudents", "name email");
        if (!event) { req.flash("error", "Event not found"); return res.redirect("/events"); }

        // Find which student this token belongs to
        let matchedStudent = null;
        for (const [studentId, qrToken] of event.studentQRs.entries()) {
            if (qrToken === token) {
                matchedStudent = event.registeredStudents.find(s => s._id.toString() === studentId);
                break;
            }
        }

        if (!matchedStudent) {
            req.flash("error", "❌ Invalid QR — student not registered for this event");
            return res.redirect(`/events/${id}/scan`);
        }

        const alreadyAttended = event.attendance.some(a => a.student.toString() === matchedStudent._id.toString());
        if (alreadyAttended) {
            req.flash("error", `⚠️ ${matchedStudent.name} is already marked as attended`);
            return res.redirect(`/events/${id}/scan`);
        }

        event.attendance.push({ student: matchedStudent._id, markedBy: req.user._id });
        await event.save();
        req.flash("success", `✅ Entry approved! ${matchedStudent.name} (${matchedStudent.email}) marked as attended`);
        res.redirect(`/events/${id}/scan`);
    } catch (err) {
        req.flash("error", "Verification failed: " + err.message);
        res.redirect("/events");
    }
};
