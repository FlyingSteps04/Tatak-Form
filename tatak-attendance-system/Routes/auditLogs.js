import express from 'express'
import { authenticateRole, authenticateToken } from '../Middleware/authentication.js'
import { getAllLogs } from '../Database/auditLogs.js'

const router = express.Router()

router.get('/', authenticateToken, authenticateRole("Admin"), async (req, res) => {
    const rows = await getAllLogs()
    res.json({success: true, data: rows})
})

export default router