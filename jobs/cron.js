const cron = require("node-cron");
const Event = require("../models/Event");
const sendEmail = require("../utils/sendEmail");

// Run every 5 minutes to check for upcoming events
cron.schedule("*/5 * * * *", async () => {
    try {
        // console.log("Checking for upcoming events to send reminders...");
        const now = new Date();
        const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        
        const upcomingEvents = await Event.find({
            date: { $gte: now, $lte: in24Hours },
            reminderSent: false
        }).populate("registeredStudents", "name email");

        if (upcomingEvents.length > 0) {
            console.log(`Found ${upcomingEvents.length} upcoming event(s) requiring reminders.`);
        }

        for (const event of upcomingEvents) {
            console.log(`Sending reminders for event: ${event.title}`);
            const students = event.registeredStudents;
            
            for (const student of students) {
                if (!student.email) continue;
                
                await sendEmail({
                    email: student.email,
                    subject: `Reminder: Upcoming Event - ${event.title}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                            <div style="background-color: #4f46e5; color: white; padding: 20px; text-align: center;">
                                <h2 style="margin: 0;">Campus Pulse Reminder</h2>
                            </div>
                            <div style="padding: 20px;">
                                <h3>Hi ${student.name},</h3>
                                <p>This is a friendly reminder that the event <strong>${event.title}</strong> is starting within the next 24 hours.</p>
                                <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #4f46e5; margin: 20px 0;">
                                    <p style="margin: 5px 0;"><strong>📅 Date & Time:</strong> ${new Date(event.date).toLocaleString()}</p>
                                    <p style="margin: 5px 0;"><strong>📍 Venue:</strong> ${event.venue}</p>
                                </div>
                                <p>We look forward to seeing you there!</p>
                            </div>
                            <div style="background-color: #f1f1f1; color: #666; padding: 10px; text-align: center; font-size: 12px;">
                                <p style="margin: 0;">You are receiving this because you registered for this event on Campus Pulse.</p>
                            </div>
                        </div>
                    `
                }).catch(err => {
                    console.error(`Failed to send reminder to ${student.email}:`, err);
                });
            }
            // Mark as sent
            event.reminderSent = true;
            await event.save();
        }

    } catch (error) {
        console.error("Cron Job Error:", error);
    }
});

console.log("⏰ Cron jobs initialized.");
