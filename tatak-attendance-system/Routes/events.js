import express from 'express';
import axios from 'axios';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { authenticateRole, authenticateToken } from '../Middleware/authentication.js';
import { addEvent, deleteEvent, getAllEvents, getEventByID, updateEvent } from '../Database/events.js';
import { getOrganizationByID } from '../Database/organizations.js';
import { addLog } from '../Database/auditLogs.js';
import { getAllStudents } from '../Database/users.js';
import { addNotification } from '../Database/notifications.js';

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
    const { organization_id, name, location, start_date, end_date } = req.body;
    let latitude, longitude;

    try {
        // 1. Database/Geocoding checks (Skipping logs since you said these work)
        const org = await getOrganizationByID(organization_id);
        if (!org) return res.status(404).json({ error: "Organization not found" });

        const geoRes = await axios.get("https://nominatim.openstreetmap.org/search", {
            params: { q: location, format: "json", limit: 1 },
            headers: { "User-Agent": "TatakAttendance/1.0" }
        });
        latitude = geoRes.data?.[0] ? parseFloat(geoRes.data[0].lat) : 0;
        longitude = geoRes.data?.[0] ? parseFloat(geoRes.data[0].lon) : 0;

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

        // 3. Database Insert
        const result = await addEvent(
            organization_id, name, location, latitude, longitude, 
            start_date, end_date, req.user.id, qrPublicPath, eventToken
        );

        const insertId = result?.insertId || result?.[0]?.insertId || result?.id;
        const event = await getEventByID(insertId);

        return res.json({ success: true, data: event, qr_url: qrPublicPath });

    } catch (error) {
        console.error("🔥 Route Error:", error);
        return res.status(500).json({ error: error.message });
    }
});
// UPDATE EVENT
router.put('/:id', authenticateToken, authenticateRole("Admin", "Officer"), async (req, res) => {
    const { id } = req.params;
    const { newName, newLocation, newStart_date, newEnd_date } = req.body;
    let { latitude, longitude } = req.body; // Allow manual override if needed

    if (!newName || !newLocation || !newStart_date) {
        return res.status(400).json({ error: "Name, location, and start date are required" });
    }

    try {
        const existingEvent = await getEventByID(id);
        if (!existingEvent) return res.status(404).json({ error: "Event not found" });

        // Update coordinates only if location changed
        if (existingEvent.location !== newLocation) {
            const geoRes = await axios.get("https://nominatim.openstreetmap.org/search", {
                params: { q: newLocation, format: "json", limit: 1 },
                headers: { "User-Agent": "TatakAttendance/1.0" }
            });
            if (geoRes.data?.length > 0) {
                latitude = parseFloat(geoRes.data[0].lat);
                longitude = parseFloat(geoRes.data[0].lon);
            } else {
                return res.status(400).json({ error: "New location not found" });
            }
        } else {
            latitude = existingEvent.latitude;
            longitude = existingEvent.longitude;
        }

        const result = await updateEvent(id, newName, newLocation, latitude, longitude, newStart_date, newEnd_date, req.user.id);

        if (!result.affectedRows) return res.status(404).json({ error: "Update failed" });

        await addLog(req.user.id, "Update Event", "events", id);
        const updated = await getEventByID(id);
        res.json({ success: true, data: updated });

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

        const result = await deleteEvent(id);
        if (!result.affectedRows) return res.status(400).json({ error: "Delete failed" });

        // Optional: Delete physical QR file
        if (event.qr_code_path) {
            const fullPath = path.join(process.cwd(), event.qr_code_path);
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        }

        await addLog(req.user.id, "Delete Event", "events", id);
        res.json({ success: true, message: "Deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


export default router;