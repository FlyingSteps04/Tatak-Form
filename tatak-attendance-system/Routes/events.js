import express from 'express';
import axios from 'axios';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { authenticateRole, authenticateToken } from '../Middleware/authentication.js';
import { addEvent, deleteEvent, getAllEvents, getEventByID, updateEvent, approveEvent } from '../Database/events.js';
import { getOrganizationByID } from '../Database/organizations.js';
import { addLog } from '../Database/auditLogs.js';
import { getAllUsers } from '../Database/users.js';
import { addNotification } from '../Database/notifications.js';

import { pool } from '../Database/connection.js';

const router = express.Router();

// Helper to ensure QR directory exists
const ensureQrDir = () => {
    const qrDir = path.join(process.cwd(), 'qr');
    if (!fs.existsSync(qrDir)) {
        fs.mkdirSync(qrDir, { recursive: true });
    }
    return qrDir;
};

// GET ALL EVENTS
router.get('/', authenticateToken, async (req, res) => {
    try {
        const events = await getAllEvents();
        res.json({ success: true, data: events });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// CREATE EVENT
router.post('/', authenticateToken, authenticateRole("Admin", "Officer"), async (req, res) => {
    const { organization_id, name, location, start_date, end_date, expected_attendance } = req.body;
    let latitude, longitude;

    try {
        // 1. Database/Geocoding checks (Skipping logs since you said these work)
        const org = await getOrganizationByID(organization_id);
        if (!org) return res.status(404).json({ error: "Organization not found" });

        try {
            const geoRes = await axios.get("https://nominatim.openstreetmap.org/search", {
                params: { q: location, format: "json", limit: 1 },
                headers: { "User-Agent": "TatakAttendance/1.0" }
            });
            latitude = geoRes.data?.[0] ? parseFloat(geoRes.data[0].lat) : 0;
            longitude = geoRes.data?.[0] ? parseFloat(geoRes.data[0].lon) : 0;
        } catch (geoErr) {
            console.warn("Geocoding failed, using 0,0:", geoErr.message);
            latitude = 0;
            longitude = 0;
        }

        // 2. QR GENERATION - THE FIX
        const eventToken = crypto.randomUUID();
        const qrPayload = JSON.stringify({ event_token: eventToken, type: "attendance" });

        // Ensure directory exists using absolute path from project root
        const qrDir = path.resolve(process.cwd(), 'qr');
        if (!fs.existsSync(qrDir)) {
            fs.mkdirSync(qrDir, { recursive: true });
        }

        const qrFileName = `${eventToken}.png`;
        const qrFilePath = path.join(qrDir, qrFileName);
        const qrPublicPath = `/qr/${qrFileName}`;

        // Using toFile directly with error handling
        try {
            await QRCode.toFile(qrFilePath, qrPayload, {
                errorCorrectionLevel: 'H',
                width: 300,
                margin: 2
            });
            console.log("✅ QR Successfully generated at:", qrFilePath);
        } catch (qrErr) {
            console.error("❌ QR File System Error:", qrErr);
            return res.status(500).json({ error: "Failed to write QR file to disk" });
        }

        // Determine initial approval status
        const initialStatus = req.user.role === 'Admin' ? 'Approved' : 'Pending';

        // 3. Database Insert
        const result = await addEvent(
            organization_id, name, location, latitude, longitude, 
            start_date, end_date, req.user.id, qrPublicPath, eventToken, initialStatus,
            expected_attendance ? parseInt(expected_attendance) : null
        );

        const insertId = result?.insertId || result?.[0]?.insertId || result?.id;
        const event = await getEventByID(insertId);

        // Notify every user that a new event has been created
        try {
            const users = await getAllUsers();
            await Promise.all(users.map(user => addNotification(
                user.id,
                'New Event Created',
                `A new event '${name}' has been created for ${org.name}.`,
                'Event'
            )));
        } catch (notifyErr) {
            console.error('Failed to send event creation notifications:', notifyErr);
        }

        return res.json({ success: true, data: event, qr_url: qrPublicPath });

    } catch (error) {
        console.error("🔥 Route Error:", error);
        return res.status(500).json({ error: error.message });
    }
});
// UPDATE EVENT
router.put('/:id', authenticateToken, authenticateRole("Admin", "Officer"), async (req, res) => {
    const { id } = req.params;
        const { name, location, start_date, end_date, expected_attendance, organization_id } = req.body;
        let { latitude, longitude } = req.body;

        if (!name || !location || !start_date) {
            return res.status(400).json({ error: "Name, location, and start date are required" });
        }

        try {
            const existingEvent = await getEventByID(id);
            if (!existingEvent) return res.status(404).json({ error: "Event not found" });

            // Update coordinates only if location changed
            if (existingEvent.location !== location) {
                try {
                    const geoRes = await axios.get("https://nominatim.openstreetmap.org/search", {
                        params: { q: location, format: "json", limit: 1 },
                        headers: { "User-Agent": "TatakAttendance/1.0" }
                    });
                    if (geoRes.data?.length > 0) {
                        latitude = parseFloat(geoRes.data[0].lat);
                        longitude = parseFloat(geoRes.data[0].lon);
                    } else {
                        latitude = 0;
                        longitude = 0;
                    }
                } catch (geoErr) {
                    console.warn("Geocoding failed during update, using 0,0:", geoErr.message);
                    latitude = 0;
                    longitude = 0;
                }
            } else {
                latitude = existingEvent.latitude;
                longitude = existingEvent.longitude;
            }

            const result = await updateEvent(id, name, location, latitude, longitude, start_date, end_date, req.user.id, expected_attendance, organization_id);
            if (!result.affectedRows) return res.status(404).json({ error: "Update failed" });

        await addLog(req.user.id, "Update Event", "events", id);
        const updated = await getEventByID(id);
        res.json({ success: true, data: updated });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// APPROVE EVENT
router.put('/:id/approve', authenticateToken, authenticateRole("Admin"), async (req, res) => {
    try {
        const { id } = req.params;
        const event = await getEventByID(id);
        
        if (!event) return res.status(404).json({ error: "Event not found" });

        const result = await approveEvent(id);
        if (!result.affectedRows) return res.status(400).json({ error: "Approval failed" });

        await addLog(req.user.id, "Approve Event", "events", id);
        
        // Notify the creator that their event was approved
        await addNotification(event.created_by, "Event Approved", `Your event '${event.name}' has been approved and is now live.`, "System");

        res.json({ success: true, message: "Event approved successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// CLOSE EVENT (Set end_date to now)
router.patch('/:id/close', authenticateToken, authenticateRole("Admin", "Officer"), async (req, res) => {
    try {
        const { id } = req.params;
        const now = new Date();
        
        // Update the event's end_date in the database
        const [result] = await pool.query('UPDATE events SET end_date = ? WHERE event_id = ?', [now, id]);
        
        if (!result.affectedRows) {
            return res.status(404).json({ error: "Event not found or already closed" });
        }

        await addLog(req.user.id, "Close Event", "events", id);
        res.json({ success: true, message: "Event closed successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE EVENT
router.delete('/:id', authenticateToken, authenticateRole("Admin", "Officer"), async (req, res) => {
    try {
        const { id } = req.params;
        const event = await getEventByID(id);
        
        if (!event) return res.status(404).json({ error: "Event not found" });

        // Delete all attendance records tied to this event first (FK constraint)
        await pool.query('DELETE FROM attendance WHERE event_id = ?', [id]);

        const result = await deleteEvent(id);
        if (!result.affectedRows) return res.status(400).json({ error: "Delete failed" });

        // Delete physical QR file from storage
        if (event.qr_code) {
            const relativePath = event.qr_code.startsWith('/') ? event.qr_code.substring(1) : event.qr_code;
            const fullPath = path.resolve(process.cwd(), relativePath);
            
            try {
                if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                    console.log("✅ Deleted QR file:", fullPath);
                }
            } catch (fsErr) {
                console.error("❌ Failed to delete QR file:", fsErr);
            }
        }

        // Notify every user that an event has been deleted
        try {
            const users = await getAllUsers();
            await Promise.all(users.map(user => addNotification(
                user.id,
                'Event Deleted',
                `The event '${event.name}' has been deleted.`,
                'Event'
            )));
        } catch (notifyErr) {
            console.error('Failed to send event deletion notifications:', notifyErr);
        }

        await addLog(req.user.id, "Delete Event", "events", id);
        res.json({ success: true, message: "Deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


export default router;