const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        password: {
            type: String,
            required: true,
        }
        // NOTE: role has been removed from User model.
        // Roles are now per-organization, stored in Organization.members[].role
    },
    { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
