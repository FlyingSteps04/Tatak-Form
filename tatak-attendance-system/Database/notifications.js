import { pool } from '../Database/connection.js'

export const getUnreadNotifications = async (userId) => {
    const query = `SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 
                    ORDER BY created_at DESC`
    const [rows] = await pool.query(query, [userId])
    return rows
}

export const getReadNotifications = async (userId) => {
    const query = `SELECT * FROM notifications WHERE user_id = ? AND is_read = 1 
                    ORDER BY created_at DESC`
    const [rows] = await pool.query(query, [userId])
    return rows
}

export const addNotification = async (userId, title, message, type = 'System') => {
    const query = `INSERT INTO notifications (user_id, title, message, type) 
                    VALUES (?, ?, ?, ?)`
    const [rows] = await pool.query(query, [userId, title, message, type])
    return rows
}

export const updateNotification = async (notificationId) => {
    const query = `UPDATE notifications SET is_read = 1 WHERE notification_id = ?`
    const [rows] = await pool.query(query, [notificationId])
    return rows
}