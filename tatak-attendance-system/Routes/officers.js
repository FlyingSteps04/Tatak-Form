import express from 'express'
import { pool } from '../Database/connection.js'
import { authenticateRole, authenticateToken } from '../Middleware/authentication.js'
import { addOrganizationOfficer, deleteOrganizationOfficer, getAllOrganizationOfficers, getOrganizationOfficerByID, updateOrganizationOfficer } from '../Database/organizationOfficer.js'
import { addLog } from '../Database/auditLogs.js'

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
            `SELECT oo.officer_id, oo.organization_id, u.fname, u.role,
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
    const { id } = req.params
    const { organizationID, position, status } = req.body

    const officer = await updateOrganizationOfficer(id, organizationID, position, status)

    if(!officer.affectedRows) return res.status(400).json({error: "Officer was not updated"})
    await addLog(req.user.id, "Update Officer", "organization_officer", id)
    res.json({success: true, message: "Officer has been updated"})
})

router.delete('/:id', authenticateToken, authenticateRole("Admin"), async (req, res) => {
    const { id } = req.params
    
    const result = await deleteOrganizationOfficer(id)
    if(!result.affectedRows) return res.status(400).json({error: "Unable to delete officer"})
    await addLog(req.user.id, "Delete Officer", "organization_officer", id)
    res.json({success: true, message: "Officer was deleted successfully"})
})

export default router