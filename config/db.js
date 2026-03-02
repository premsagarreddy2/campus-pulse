const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URL, {
            tls: true,
            tlsAllowInvalidCertificates: false,
            serverSelectionTimeoutMS: 10000,
        });
        console.log("MongoDB Connected Successfully ✅");
    } catch (error) {
        console.error("Database connection failed ❌:", error.message);
        process.exit(1);
    }
};

module.exports = connectDB;
