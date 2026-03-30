const Event = require("../models/Event");
const crypto = require("crypto");
const QRCode = require("qrcode");
const Razorpay = require("razorpay");

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

// GET /:slug/events  — dashboard
exports.getEvents = async (req, res) => {
    try {
        const { search = "", status = "All", category = "All", page = 1 } = req.query;
        const limit = 9;
        const basePath = `/${req.org.slug}`;

        let query = { organization: req.org._id };
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
        if (req.user && req.userRole === "student") {
            const mine = await Event.find({
                organization: req.org._id,
                registeredStudents: req.user._id
            }, "_id");
            myRegisteredIds = new Set(mine.map(e => e._id.toString()));
        }

        const total = events.length;
        const pages = Math.ceil(total / limit) || 1;
        const currentPage = parseInt(page);
        const paginatedEvents = events.slice((currentPage - 1) * limit, currentPage * limit);

        res.render("events/dashboard", {
            title: `Dashboard — ${req.org.name}`,
            events: paginatedEvents,
            myRegisteredIds,
            search, status, category,
            categories: CATEGORIES,
            currentPage, pages, total,
            basePath
        });
    } catch (err) {
        console.error("getEvents error:", err);
        req.flash("error", "Failed to load events");
        res.redirect("/");
    }
};

// GET /:slug/events/:id  — single event detail
exports.getEventById = async (req, res) => {
    try {
        const basePath = `/${req.org.slug}`;
        const event = await Event.findOne({ _id: req.params.id, organization: req.org._id })
            .populate("createdBy", "name email role")
            .populate("registeredStudents", "name email");

        if (!event) { req.flash("error", "Event not found"); return res.redirect(`${basePath}/events`); }

        const status = getStatus(event);
        const isRegistered = req.user
            ? event.registeredStudents.some(s => s._id.toString() === req.user._id)
            : false;

        res.render("events/detail", {
            title: `${event.title} — ${req.org.name}`,
            event: { ...event.toObject(), status, catEmoji: CAT_EMOJI[event.category] || "📌" },
            isRegistered,
            categories: CATEGORIES,
            basePath
        });
    } catch (err) {
        req.flash("error", "Event not found");
        res.redirect(`/${req.org.slug}/events`);
    }
};

// GET /:slug/events/new  — create form
exports.showCreateForm = (req, res) => {
    const basePath = `/${req.org.slug}`;
    res.render("events/form", {
        title: `Create Event — ${req.org.name}`,
        event: null,
        categories: CATEGORIES,
        formAction: `${basePath}/events`,
        formMethod: "POST",
        basePath
    });
};

// POST /:slug/events  — create
exports.createEvent = async (req, res) => {
    const basePath = `/${req.org.slug}`;
    try {
        const { title, description, date, venue, durationHours, category, maxSeats, isPaid, registrationFee } = req.body;
        const qrToken = crypto.randomBytes(32).toString("hex");

        await Event.create({
            organization: req.org._id,
            title, description, date, venue,
            durationHours: durationHours || 2,
            category: category || "Other",
            maxSeats: parseInt(maxSeats) || 0,
            isPaid: isPaid === 'true',
            registrationFee: isPaid === 'true' ? Number(registrationFee) : 0,
            qrToken,
            image: req.file ? req.file.path : null,
            createdBy: req.user._id
        });

        req.flash("success", "Event created successfully! 🎉");
        res.redirect(`${basePath}/events`);
    } catch (err) {
        req.flash("error", "Failed to create event: " + err.message);
        res.redirect(`${basePath}/events/new`);
    }
};

// GET /:slug/events/:id/edit
exports.showEditForm = async (req, res) => {
    const basePath = `/${req.org.slug}`;
    try {
        const event = await Event.findOne({ _id: req.params.id, organization: req.org._id });
        if (!event) { req.flash("error", "Event not found"); return res.redirect(`${basePath}/events`); }

        if (req.userRole !== "admin" && event.createdBy.toString() !== req.user._id) {
            req.flash("error", "Not authorized to edit this event");
            return res.redirect(`${basePath}/events`);
        }

        res.render("events/form", {
            title: `Edit Event — ${req.org.name}`,
            event: event.toObject(),
            categories: CATEGORIES,
            formAction: `${basePath}/events/${event._id}?_method=PUT`,
            formMethod: "POST",
            basePath
        });
    } catch (err) {
        req.flash("error", "Event not found");
        res.redirect(`${basePath}/events`);
    }
};

// PUT /:slug/events/:id
exports.updateEvent = async (req, res) => {
    const basePath = `/${req.org.slug}`;
    try {
        const event = await Event.findOne({ _id: req.params.id, organization: req.org._id });
        if (!event) { req.flash("error", "Event not found"); return res.redirect(`${basePath}/events`); }

        if (req.userRole !== "admin" && event.createdBy.toString() !== req.user._id) {
            req.flash("error", "Not authorized");
            return res.redirect(`${basePath}/events`);
        }

        const { title, description, date, venue, category, maxSeats, durationHours, isPaid, registrationFee } = req.body;
        event.title = title || event.title;
        event.description = description || event.description;
        event.date = date || event.date;
        event.venue = venue || event.venue;
        event.category = category || event.category;
        event.maxSeats = parseInt(maxSeats) >= 0 ? parseInt(maxSeats) : event.maxSeats;
        event.durationHours = durationHours || event.durationHours;
        event.isPaid = isPaid === 'true';
        event.registrationFee = event.isPaid ? Number(registrationFee) : 0;
        if (req.file) event.image = req.file.path;

        await event.save();
        req.flash("success", "Event updated ✅");
        res.redirect(`${basePath}/events/${event._id}`);
    } catch (err) {
        req.flash("error", "Update failed");
        res.redirect(`${basePath}/events`);
    }
};

// DELETE /:slug/events/:id
exports.deleteEvent = async (req, res) => {
    const basePath = `/${req.org.slug}`;
    try {
        const event = await Event.findOne({ _id: req.params.id, organization: req.org._id });
        if (!event) { req.flash("error", "Event not found"); return res.redirect(`${basePath}/events`); }

        if (req.userRole !== "admin" && event.createdBy.toString() !== req.user._id) {
            req.flash("error", "Not authorized");
            return res.redirect(`${basePath}/events`);
        }

        await event.deleteOne();
        req.flash("success", "Event deleted 🗑️");
        res.redirect(`${basePath}/events`);
    } catch (err) {
        req.flash("error", "Delete failed");
        res.redirect(`${basePath}/events`);
    }
};

// POST /:slug/events/:id/register
exports.registerForEvent = async (req, res) => {
    const basePath = `/${req.org.slug}`;
    try {
        const event = await Event.findOne({ _id: req.params.id, organization: req.org._id });
        if (!event) { req.flash("error", "Event not found"); return res.redirect(`${basePath}/events`); }

        const now = new Date();
        const eventEnd = new Date(event.date);
        eventEnd.setHours(eventEnd.getHours() + (event.durationHours || 2));
        if (now > eventEnd) {
            req.flash("error", "Registration closed — event has ended");
            return res.redirect(`${basePath}/events/${req.params.id}`);
        }

        if (event.registeredStudents.some(s => s.toString() === req.user._id)) {
            req.flash("error", "You are already registered");
            return res.redirect(`${basePath}/events/${req.params.id}`);
        }

        if (event.maxSeats > 0 && event.registeredStudents.length >= event.maxSeats) {
            req.flash("error", "This event is full!");
            return res.redirect(`${basePath}/events/${req.params.id}`);
        }

        event.registeredStudents.push(req.user._id);
        const studentQRToken = crypto.randomBytes(32).toString("hex");
        event.studentQRs.set(req.user._id.toString(), studentQRToken);
        await event.save();

        req.flash("success", "Registered successfully! 🎉 View your entry QR in My Events.");
        res.redirect(`${basePath}/events/${req.params.id}`);
    } catch (err) {
        req.flash("error", "Registration failed: " + err.message);
        res.redirect(`${basePath}/events`);
    }
};

// POST /:slug/events/:id/create-order
exports.createPaymentOrder = async (req, res) => {
    try {
        const Organization = require("../models/Organization");
        const event = await Event.findOne({ _id: req.params.id, organization: req.org._id });
        if (!event || !event.isPaid) {
            return res.status(400).json({ error: "Invalid event or not a paid event" });
        }

        const org = await Organization.findById(req.org._id);
        const keyId = org.razorpayKeyId || process.env.RAZORPAY_KEY_ID;
        const keySecret = org.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET;

        if (!keyId || !keySecret) {
            return res.status(500).json({ error: "Razorpay is not configured for this organization" });
        }

        const razorpay = new Razorpay({
            key_id: keyId,
            key_secret: keySecret
        });

        const options = {
            amount: event.registrationFee * 100, // Amount in paise
            currency: "INR",
            receipt: `receipt_ev_${event._id.toString().substring(0, 6)}_${Date.now()}`
        };

        const order = await razorpay.orders.create(options);
        res.status(200).json({ order, key_id: keyId });
    } catch (err) {
        console.error("Razorpay order error:", err);
        res.status(500).json({ error: "Failed to create payment order" });
    }
};

// POST /:slug/events/:id/verify-payment
exports.verifyPayment = async (req, res) => {
    const basePath = `/${req.org.slug}`;
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
        const Organization = require("../models/Organization");
        const event = await Event.findOne({ _id: req.params.id, organization: req.org._id });

        if (!event || !event.isPaid) {
            req.flash("error", "Invalid event or not a paid event");
            return res.redirect(`${basePath}/events/${req.params.id}`);
        }

        const org = await Organization.findById(req.org._id);
        const keySecret = org.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET;

        if (!keySecret) {
            req.flash("error", "Razorpay configuration missing on server");
            return res.redirect(`${basePath}/events/${req.params.id}`);
        }

        const generatedSignature = crypto.createHmac("sha256", keySecret)
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest("hex");

        if (generatedSignature !== razorpay_signature) {
            req.flash("error", "Payment verification failed — invalid signature");
            return res.redirect(`${basePath}/events/${req.params.id}`);
        }

        if (event.registeredStudents.some(s => s.toString() === req.user._id.toString())) {
            req.flash("error", "You are already registered");
            return res.redirect(`${basePath}/events/${req.params.id}`);
        }

        if (event.maxSeats > 0 && event.registeredStudents.length >= event.maxSeats) {
            req.flash("error", "This event is full!");
            return res.redirect(`${basePath}/events/${req.params.id}`);
        }

        const studentQRToken = crypto.randomBytes(32).toString("hex");

        event.payments.push({
            student: req.user._id,
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id,
            signature: razorpay_signature,
            amount: event.registrationFee,
            status: "success"
        });
        event.registeredStudents.push(req.user._id);
        event.studentQRs.set(req.user._id.toString(), studentQRToken);

        await event.save();

        req.flash("success", "Payment successful! You are now registered. 🎉");
        res.redirect(`${basePath}/events/${req.params.id}`);

    } catch (err) {
        console.error("Payment verification error:", err);
        req.flash("error", "An error occurred verifying your payment.");
        res.redirect(`${basePath}/events/${req.params.id}`);
    }
};

// GET /:slug/events/my-events
exports.getMyEvents = async (req, res) => {
    const basePath = `/${req.org.slug}`;
    try {
        const events = await Event.find({
            organization: req.org._id,
            registeredStudents: req.user._id
        }).populate("createdBy", "name");

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
            title: `My Events — ${req.org.name}`,
            events: enriched,
            stats,
            basePath
        });
    } catch (err) {
        req.flash("error", "Failed to load your events");
        res.redirect(`${basePath}/events`);
    }
};

// GET /:slug/events/:id/participants
exports.getEventParticipants = async (req, res) => {
    const basePath = `/${req.org.slug}`;
    try {
        const event = await Event.findOne({ _id: req.params.id, organization: req.org._id })
            .populate("registeredStudents", "name email")
            .populate("attendance.student", "name email")
            .populate("createdBy", "name");

        if (!event) { req.flash("error", "Event not found"); return res.redirect(`${basePath}/events`); }

        const attendedIds = new Set(event.attendance.map(a => a.student._id.toString()));

        const participants = event.registeredStudents.map(s => ({
            ...s.toObject(),
            attended: attendedIds.has(s._id.toString())
        }));

        res.render("events/participants", {
            title: `Participants — ${event.title}`,
            event: { ...event.toObject(), status: getStatus(event) },
            participants,
            totalAttended: event.attendance.length,
            basePath
        });
    } catch (err) {
        req.flash("error", "Failed to load participants");
        res.redirect(`${basePath}/events`);
    }
};

// GET /:slug/events/:id/qr
exports.showQRPage = async (req, res) => {
    const basePath = `/${req.org.slug}`;
    try {
        const event = await Event.findOne({ _id: req.params.id, organization: req.org._id });
        if (!event) { req.flash("error", "Event not found"); return res.redirect(`${basePath}/events`); }

        if (!event.qrToken) {
            event.qrToken = crypto.randomBytes(32).toString("hex");
            await event.save();
        }

        const qrUrl = `${req.protocol}://${req.get("host")}${basePath}/events/${event._id}/attend/${event.qrToken}`;

        const qrDataURL = await QRCode.toDataURL(qrUrl, {
            width: 280, margin: 2,
            color: { dark: "#000000", light: "#ffffff" }
        });

        res.render("events/qr", {
            title: `QR Attendance — ${event.title}`,
            event: event.toObject(),
            qrUrl,
            qrDataURL,
            basePath
        });
    } catch (err) {
        req.flash("error", "Failed to generate QR");
        res.redirect(`${basePath}/events`);
    }
};

// GET /:slug/events/:id/scan
exports.showScanPage = async (req, res) => {
    const basePath = `/${req.org.slug}`;
    try {
        const event = await Event.findOne({ _id: req.params.id, organization: req.org._id });
        if (!event) { req.flash("error", "Event not found"); return res.redirect(`${basePath}/events`); }

        res.render("events/scan-entry", {
            title: `Scan Entry — ${event.title}`,
            event: event.toObject(),
            basePath
        });
    } catch (err) {
        req.flash("error", "Failed to load scan page");
        res.redirect(`${basePath}/events`);
    }
};

// GET /:slug/events/:id/my-qr
exports.showStudentQR = async (req, res) => {
    const basePath = `/${req.org.slug}`;
    try {
        const event = await Event.findOne({ _id: req.params.id, organization: req.org._id });
        if (!event) { req.flash("error", "Event not found"); return res.redirect(`${basePath}/events/my-events`); }

        const isRegistered = event.registeredStudents.some(s => s.toString() === req.user._id);
        if (!isRegistered) {
            req.flash("error", "You are not registered for this event");
            return res.redirect(`${basePath}/events/my-events`);
        }

        let qrToken = event.studentQRs.get(req.user._id.toString());
        if (!qrToken) {
            qrToken = crypto.randomBytes(32).toString("hex");
            event.studentQRs.set(req.user._id.toString(), qrToken);
            await event.save();
        }

        const verifyUrl = `${req.protocol}://${req.get("host")}${basePath}/events/${event._id}/verify-entry/${qrToken}`;

        const qrDataURL = await QRCode.toDataURL(verifyUrl, {
            width: 280, margin: 2,
            color: { dark: "#000000", light: "#ffffff" }
        });

        res.render("events/student-qr", {
            title: `My Entry QR — ${event.title}`,
            event: event.toObject(),
            qrDataURL,
            basePath
        });
    } catch (err) {
        req.flash("error", "Failed to generate QR: " + err.message);
        res.redirect(`${basePath}/events/my-events`);
    }
};

// GET /:slug/events/:id/attend/:token
exports.markAttendanceByQR = async (req, res) => {
    const basePath = `/${req.org.slug}`;
    try {
        const { id, token } = req.params;
        const event = await Event.findOne({ _id: id, organization: req.org._id });

        if (!event || event.qrToken !== token) {
            req.flash("error", "Invalid QR code");
            return res.redirect(`${basePath}/events`);
        }

        const now = new Date();
        const start = new Date(event.date);
        const end = new Date(start);
        end.setHours(start.getHours() + (event.durationHours || 2) + 2);

        if (now < start) { req.flash("error", "Event hasn't started yet"); return res.redirect(`${basePath}/events`); }
        if (now > end) { req.flash("error", "Attendance window has closed"); return res.redirect(`${basePath}/events`); }

        if (!event.registeredStudents.some(s => s.toString() === req.user._id)) {
            req.flash("error", "You are not registered for this event");
            return res.redirect(`${basePath}/events`);
        }

        if (event.attendance.some(a => a.student.toString() === req.user._id)) {
            req.flash("success", "Attendance already marked ✅");
            return res.redirect(`${basePath}/events/my-events`);
        }

        event.attendance.push({ student: req.user._id });
        await event.save();
        req.flash("success", `Attendance marked for "${event.title}" 🎉`);
        res.redirect(`${basePath}/events/my-events`);
    } catch (err) {
        req.flash("error", "Failed to mark attendance");
        res.redirect(`${basePath}/events`);
    }
};

// POST /:slug/events/:id/manual-attend
exports.manualMarkAttendance = async (req, res) => {
    const basePath = `/${req.org.slug}`;
    try {
        const { studentId } = req.body;
        const event = await Event.findOne({ _id: req.params.id, organization: req.org._id });
        if (!event) { req.flash("error", "Event not found"); return res.redirect(`${basePath}/events`); }

        if (event.attendance.some(a => a.student.toString() === studentId)) {
            req.flash("error", "Attendance already marked for this student");
        } else {
            event.attendance.push({ student: studentId, markedBy: req.user._id });
            await event.save();
            req.flash("success", "Attendance marked ✅");
        }

        res.redirect(`${basePath}/events/${req.params.id}/participants`);
    } catch (err) {
        req.flash("error", "Failed to mark attendance");
        res.redirect(`${basePath}/events`);
    }
};

// GET /:slug/events/:id/verify-entry/:token
exports.verifyStudentEntry = async (req, res) => {
    const basePath = `/${req.org.slug}`;
    try {
        const { id, token } = req.params;
        const event = await Event.findOne({ _id: id, organization: req.org._id })
            .populate("registeredStudents", "name email");
        if (!event) { req.flash("error", "Event not found"); return res.redirect(`${basePath}/events`); }

        let matchedStudent = null;
        for (const [studentId, qrToken] of event.studentQRs.entries()) {
            if (qrToken === token) {
                matchedStudent = event.registeredStudents.find(s => s._id.toString() === studentId);
                break;
            }
        }

        if (!matchedStudent) {
            req.flash("error", "❌ Invalid QR — student not registered for this event");
            return res.redirect(`${basePath}/events/${id}/scan`);
        }

        const alreadyAttended = event.attendance.some(a => a.student.toString() === matchedStudent._id.toString());
        if (alreadyAttended) {
            req.flash("error", `⚠️ ${matchedStudent.name} is already marked as attended`);
            return res.redirect(`${basePath}/events/${id}/scan`);
        }

        event.attendance.push({ student: matchedStudent._id, markedBy: req.user._id });
        await event.save();
        req.flash("success", `✅ Entry approved! ${matchedStudent.name} (${matchedStudent.email}) marked as attended`);
        res.redirect(`${basePath}/events/${id}/scan`);
    } catch (err) {
        req.flash("error", "Verification failed: " + err.message);
        res.redirect(`${basePath}/events`);
    }
};
