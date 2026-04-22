import express from 'express'
import { authenticateRole, authenticateToken } from '../Middleware/authentication.js'
import { getReadNotifications, getUnreadNotifications, updateNotification } from '../Database/notifications.js'

const router = express.Router()

router.get('/', authenticateToken, async (req, res) => {
    const unread = await getUnreadNotifications(req.user.id)
    const read = await getReadNotifications(req.user.id)

    res.json({unread, read})
})

router.put('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params
    await updateNotification(id)
    res.json({success: true, message: `Notification ${id} has been read`})
})

export default router