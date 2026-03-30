const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: {
        type: String,
        enum: ["admin", "coordinator", "student"],
        default: "student"
    },
    joinedAt: { type: Date, default: Date.now }
});

const organizationSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be URL-safe (lowercase letters, numbers, hyphens)"]
        },
        description: {
            type: String,
            default: ""
        },
        logo: {
            type: String,
            default: null
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        members: [memberSchema],
        razorpayKeyId: {
            type: String,
            default: null
        },
        razorpayKeySecret: {
            type: String,
            default: null
        }
    },
    { timestamps: true }
);

// Fast member lookups
organizationSchema.index({ "members.user": 1 });

module.exports = mongoose.model("Organization", organizationSchema);
