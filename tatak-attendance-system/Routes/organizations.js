import express from 'express'
import { authenticateToken, authenticateRole } from '../Middleware/authentication.js'
import { addOrganization, addOrganizationWithId, deleteOrganization, getAllOrganizations, getOrganizationByID, updateOrganization } from '../Database/organizations.js'
import { addLog } from '../Database/auditLogs.js'

const router = express.Router()

router.get('/', authenticateToken, async (req, res) => {
    const rows = await getAllOrganizations()
    res.json({success: true, data: rows})
})

router.post('/', authenticateToken, authenticateRole("Admin"), async (req, res) => {
    const { organization_id, name, description } = req.body
    if(!name) return res.status(400).json({error: "Organization name is required"})

    // Parse custom ID — must be a positive integer if provided
    const customId = organization_id ? parseInt(organization_id, 10) : null
    if (organization_id && (!customId || customId < 1)) {
        return res.status(400).json({ error: "Organization ID must be a positive integer" })
    }
    
    const result = await addOrganizationWithId(customId, name, description)
    if(!result) return res.status(500).json({error: "Unable to create organization"})
    
    const insertedId = customId || result.insertId
    await addLog(req.user.id, "Add Organization", "organizations", insertedId)
    const newOrg = await getOrganizationByID(insertedId)

    res.status(201).json({success: true, message: "Organization Created", data: newOrg})
})

router.delete('/:id', authenticateToken, authenticateRole("Admin"), async (req, res) => {
    const { id } = req.params
    const result = await deleteOrganization(id)
    if(!result.affectedRows) return res.status(400).json({error: "Unable to delete"})
    await addLog(req.user.id, "Delete Organization", "organizations", id)
    res.status(200).json({success: true, message: "Organization Deleted"})
})

router.put('/:id', authenticateToken, authenticateRole("Admin"), async (req, res) => {
    const { id } = req.params
    const { name, description } = req.body
    if(!name) return res.status(400).json({error: "Organization name is required"})
    
    const result = await updateOrganization(id, name, description)
    
    if(!result.affectedRows) return res.status(400).json({error: "Unable to update"})
    
    await addLog(req.user.id, "Update Organization", "organizations", id)
    const newOrg = await getOrganizationByID(id)
    
    res.status(200).json({success: true, message: "Organization Updated", data: newOrg})
})

export default router