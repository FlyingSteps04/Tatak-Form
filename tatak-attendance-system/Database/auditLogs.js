import { pool } from '../Database/connection.js'

export const getAllLogs = async () => {
    const query = `
        SELECT al.*, u.fname, u.role,
               CASE 
                   WHEN al.table_name = 'events' THEN e.name
                   WHEN al.table_name = 'users' THEN u2.fname
                   WHEN al.table_name = 'attendance' THEN CONCAT('Attendance: ', ev_att.name)
                   ELSE NULL 
               END as target_name
        FROM audit_logs al 
        LEFT JOIN users u ON al.user_id = u.id 
        LEFT JOIN events e ON al.table_name = 'events' AND al.record_id = e.event_id
        LEFT JOIN users u2 ON al.table_name = 'users' AND al.record_id = u2.id
        LEFT JOIN attendance att ON al.table_name = 'attendance' AND al.record_id = att.attendance_id
        LEFT JOIN events ev_att ON att.event_id = ev_att.event_id
        ORDER BY al.timestamp DESC`
    const [rows] = await pool.query(query)
    return rows
}

export const addLog = async (userId, action, tableName, recordId) => {
    const query = `INSERT INTO audit_logs (user_id, action, table_name, record_id) 
                    VALUES (?, ?, ?, ?)`
    const [rows] = await pool.query(query, [userId, action, tableName, recordId])
}