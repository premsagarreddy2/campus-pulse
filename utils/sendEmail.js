const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: process.env.EMAIL_PORT || 465,
    secure: true, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendEmail = async (options) => {
    try {
        // If EMAIL_USER and EMAIL_PASS are not configured, log a warning and skip to avoid crashing
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.warn("⚠️ EMAIL_USER or EMAIL_PASS not set. Skipping email send. Content that would have been sent:");
            console.log(`To: ${options.email}\nSubject: ${options.subject}\nHTML: ${options.html}`);
            return;
        }

        const mailOptions = {
            from: `"Campus Pulse" <${process.env.EMAIL_USER}>`,
            to: options.email,
            subject: options.subject,
            html: options.html,
        };

        const info = await transporter.sendMail(mailOptions);
        // console.log("Email sent: %s", info.messageId);
    } catch (error) {
        console.error("Error sending email: ", error);
        throw error;
    }
};

module.exports = sendEmail;
