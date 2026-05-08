import express from 'express'
import { authenticateRole, authenticateToken } from '../Middleware/authentication.js'
import { getAllAttendanceByEventID, getAllAttendanceByUserID, getAttendanceByID, getAttendanceSummary, getAttendanceSummaryByOrg, markAttendance, updateAttendance, overrideAttendance, getEventByToken, checkExistingAttendance, getAllAttendance } from '../Database/attendance.js'
import { validateAttendance } from '../Middleware/validateAttendance.js'
import { addNotification } from '../Database/notifications.js'
import { getEventByID } from '../Database/events.js'
import { addLog } from '../Database/auditLogs.js'
import { getUserByID, updateUser } from '../Database/users.js'

const router = express.Router()

router.get('/all', authenticateToken, authenticateRole("Admin", "Officer"), async (req, res) => {
    try {
        const rows = await getAllAttendance()
        res.json({ success: true, data: rows })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

router.post('/admin-override', authenticateToken, authenticateRole("Admin", "Officer"), async (req, res) => {
    const { user_id, event_id, status } = req.body;
    try {
        if (!user_id || !event_id || !status) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        await overrideAttendance(user_id, event_id, status);
        
        const event = await getEventByID(event_id);
        await addNotification(user_id, "Attendance Overridden", `Your attendance for ${event?.name || 'an event'} was updated to ${status} by an admin.`, "Attendance");
        await addLog(req.user.id, "Override Attendance", "attendance", user_id);
        
        res.json({ success: true, message: "Attendance overridden successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/users', authenticateToken, authenticateRole("Student"), async (req, res) => {
    const rows = await getAllAttendanceByUserID(req.user.id)
    res.json({success: true, data: rows})
})

router.get('/personnel/:eventId', authenticateToken, authenticateRole("Admin", "Officer"), async (req, res) => {
    const { eventId } = req.params
    const rows = await getAllAttendanceByEventID(eventId)
    res.json({success: true, data: rows})
})

router.get('/summary', authenticateToken, authenticateRole("Admin", "Officer"), async (req, res) => {
    const rows = await getAttendanceSummary()
    res.json({ success: true, data: rows })
})

// GET ATTENDANCE SUMMARY FILTERED BY ORG
router.get('/summary/org/:orgId', authenticateToken, authenticateRole("Admin", "Officer"), async (req, res) => {
    try {
        const { orgId } = req.params;
        const rows = await getAttendanceSummaryByOrg(orgId);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})


router.put('/:id', authenticateToken, authenticateRole("Admin", "Officer"), async (req, res) => {
    const { id } = req.params
    const { status } = req.body
    const rows = await getAttendanceByID(id)
    await updateAttendance(id, status)
    await addNotification(rows.user_id, "Attendance Updated", `Your attendance for the event (${rows.event_name}) has been updated`, "Attendance")

    res.json({success: true, message: "Attendance updated"})
})

router.post('/scan', authenticateToken, async (req, res) => {
    console.log("✅ POST /attendance/scan hit!");
    const { event_token, user_latitude, user_longitude } = req.body;
    const userId = req.user.id;

    // 1. Validate Input
    if (!event_token) {
        return res.status(400).json({ error: "Event token is missing" });
    }
    
    // Check if coordinates are provided (Crucial for geofencing)
    if (user_latitude === undefined || user_longitude === undefined) {
        return res.status(400).json({ error: "Location data is required for verification" });
    }

    try {
        // 2. Find the event
        const event = await getEventByToken(event_token);
        if (!event) {
            return res.status(404).json({ error: "Invalid QR Code" });
        }

        // 3. Prevent Duplicate Attendance
        // You should check if a record already exists for this user and event
        const existingRecord = await checkExistingAttendance(userId, event.event_id);
        if (existingRecord) {
            return res.status(400).json({ error: "Attendance already recorded for this event" });
        }

        // 4. Time Verification
        const now = new Date();
        const start = new Date(event.start_date);
        const end = event.end_date ? new Date(event.end_date) : null;

        if (now < start) {
            return res.status(400).json({ error: "Event has not started yet" });
        }
        if (end && now > end) {
            return res.status(400).json({ error: "Event has already ended" });
        }

        // 5. Geofencing Logic
        const distance = calculateDistance(
            parseFloat(user_latitude), 
            parseFloat(user_longitude), 
            event.latitude, 
            event.longitude
        );

        const radius = 200; // 200 meters
        if (distance > radius) {
            return res.status(400).json({ 
                error: "Verification failed: You must be at the venue",
                venue: event.location,
                distance: `${Math.round(distance)}m away`
            });
        }

        // 6. Organization Assignment (If student has no org, assign them to the event's org)
        const user = await getUserByID(userId);
        if (user && !user.organization_id) {
            await updateUser(userId, { organization_id: event.organization_id });
            console.log(`Auto-assigned user ${userId} to organization ${event.organization_id}`);
        }

        // 7. Record Attendance & Log
        await markAttendance(userId, event.event_id, "Present");
        await addLog(userId, "Scanned QR", "attendance", event.event_id);
        
        await addNotification(userId, "Attendance Recorded", `You have successfully attended ${event.name}`, "Attendance");

        return res.json({ 
            success: true, 
            message: `Success! Attendance confirmed for ${event.name}` 
        });

    } catch (error) {
        console.error("SCAN ERROR:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.post('/:eventId', authenticateToken, authenticateRole("Student"), validateAttendance, async (req, res) => {
    const { eventId } = req.params
    const rows = await markAttendance(req.user.id, eventId)
    const result = await getAllAttendanceByEventID(eventId)
    await addNotification(req.user.id, "Attendance Marked", `Your attendance for the event (${result.event_name}) has been logged`, "Attendance")
    res.json({success: true, message: "Attendance marked", data: rows})
})

router.get('/scan', (req, res) => {
    res.json({ message: "Attendance scan endpoint is active (requires POST)." });
});

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}
export default router;