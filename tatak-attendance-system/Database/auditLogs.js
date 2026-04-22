import { pool } from '../Database/connection.js'

export const getAllLogs = async () => {
    const query = `SELECT * FROM audit_logs ORDER BY timestamp DESC`
    const [rows] = await pool.query(query)
    return rows
}

export const addLog = async (userId, action, tableName, recordId) => {
    const query = `INSERT INTO audit_logs (user_id, action, table_name, record_id) 
                    VALUES (?, ?, ?, ?)`
    const [rows] = await pool.query(query, [userId, action, tableName, recordId])
}