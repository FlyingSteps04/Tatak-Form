import express from 'express'
import { pool } from '../Database/connection.js'
import { authenticateRole, authenticateToken } from '../Middleware/authentication.js'
import { addOrganizationOfficer, deleteOrganizationOfficer, getAllOrganizationOfficers, getOrganizationOfficerByID, updateOrganizationOfficer } from '../Database/organizationOfficer.js'
import { addLog } from '../Database/auditLogs.js'
import { updateUser, deleteUserRecursive } from '../Database/users.js'
import { processImage } from '../scripts/imageHelper.js'

const router = express.Router()

router.get('/', authenticateToken, authenticateRole("Admin"), async (req, res) => {
    const rows = await getAllOrganizationOfficers()
    res.json({success: true, data: rows})
})

// GET /officers/me — returns the logged-in officer's profile + organization_id
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id
        const [rows] = await pool.query(
            `SELECT oo.officer_id, oo.organization_id, u.fname, u.role, u.profile_picture,
                    o.name AS organization_name
             FROM organization_officer oo
             JOIN users u  ON oo.user_id = u.id
             JOIN organizations o ON oo.organization_id = o.organization_id
             WHERE oo.user_id = ?
             LIMIT 1`,
            [userId]
        )
        if (!rows.length) return res.status(404).json({ success: false, error: 'Officer profile not found' })
        res.json({ success: true, data: rows[0] })
    } catch (err) {
        console.error('GET /officers/me error:', err)
        res.status(500).json({ success: false, error: 'Server error' })
    }
})

router.post('/', authenticateToken, authenticateRole("Admin"), async (req, res) => {
    // Frontend sends: user_id, organization_id, position, term_start, term_end, status
    // Backend previously expected: userID, organizationID
    const { 
        userID, user_id, 
        organizationID, organization_id, 
        position, term_start, term_end, status 
    } = req.body

    const finalUserId = userID || user_id
    const finalOrgId = organizationID || organization_id

    if (!finalUserId || !finalOrgId) {
        return res.status(400).json({ error: "User ID and Organization ID are required" })
    }

    const result = await addOrganizationOfficer(
        finalOrgId, 
        finalUserId, 
        position, 
        term_start, 
        term_end, 
        status
    )

    if (!result.affectedRows) return res.status(400).json({ error: "User was not added as an officer. Ensure the user exists and has the 'Officer' role." })
    
    await addLog(req.user.id, "Add Officer", "organization_officer", result.insertId)
    const officer = await getOrganizationOfficerByID(result.insertId)
    res.json({ success: true, message: "User added as an officer", data: officer })
})

router.put('/:id', authenticateToken, authenticateRole("Admin"), async (req, res) => {
    try {
        const { id } = req.params
        const { organizationID, organization_id, position, status, fname, profile_picture } = req.body
        
        // Handle both naming conventions for organization ID
        const finalOrgId = organizationID || organization_id

        if (!finalOrgId) {
            return res.status(400).json({ success: false, error: "Organization ID is required" })
        }

        // 1. Update the officer record (org, position, status)
        const result = await updateOrganizationOfficer(id, finalOrgId, position, status)

        if (!result.affectedRows) {
            return res.status(400).json({ success: false, error: "Officer record not found or no changes made" })
        }

        // 2. Sync changes with the associated user record (fname and organization_id)
        const officerData = await getOrganizationOfficerByID(id)
        if (officerData && officerData.user_id) {
            const updatePayload = {}
            if (fname) updatePayload.fname = fname
            if (finalOrgId) updatePayload.organization_id = finalOrgId
            if (profile_picture) updatePayload.profile_picture = processImage(profile_picture, 'profiles')
            
            if (Object.keys(updatePayload).length > 0) {
                await updateUser(officerData.user_id, updatePayload)
            }
        }

        await addLog(req.user.id, "Update Officer", "organization_officer", id)
        res.json({ success: true, message: "Officer has been updated successfully" })
    } catch (err) {
        console.error('PUT /officers/:id error:', err)
        res.status(500).json({ success: false, error: "Server error while updating officer" })
    }
})

router.delete('/:id', authenticateToken, authenticateRole("Admin"), async (req, res) => {
    const { id } = req.params
    try {
        // 1. Get the user_id associated with this officer record
        const officer = await getOrganizationOfficerByID(id);
        if (!officer) return res.status(404).json({ success: false, error: "Officer record not found" });

        // 2. Perform a recursive delete on the USER account
        const result = await deleteUserRecursive(officer.user_id);
        
        if (!result.affectedRows) return res.status(400).json({ success: false, error: "Unable to delete officer account" });

        await addLog(req.user.id, "Delete Officer", "users", officer.user_id);
        res.json({ success: true, message: "Officer and associated user account deleted successfully" });
    } catch (err) {
        console.error('DELETE /officers/:id error:', err);
        res.status(500).json({ success: false, error: "Server error during officer deletion" });
    }
})

export default router