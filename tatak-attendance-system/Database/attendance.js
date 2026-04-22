import { pool } from '../Database/connection.js'

export const getAllAttendanceByUserID = async (userId) => {
    const query = `SELECT a.attendance_id, a.status, a.timestamp, u.fname, e.name AS event_name
                    FROM attendance a 
                    JOIN users u ON a.user_id = u.id
                    JOIN events e ON a.event_id = e.event_id 
                    WHERE a.user_id = ? 
                    ORDER BY timestamp DESC`
    const [rows] = await pool.query(query, [userId])
    return rows
}

export const getAllAttendanceByEventID = async (eventId) => {
    const query = `SELECT a.attendance_id, a.status, a.timestamp,
                    u.fname, u.stud_id_number, u.username,
                    e.name AS event_name
                    FROM attendance a
                    JOIN users u ON a.user_id = u.id
                    JOIN events e ON a.event_id = e.event_id
                    WHERE a.event_id = ?
                    ORDER BY a.timestamp DESC`
    const [rows] = await pool.query(query, [eventId])
    return rows
}

export const getAttendanceByID = async (attendanceId) => {
    const query = `SELECT a.attendance_id, a.status, u.fname, u.id AS user_id, e.name AS event_name 
                    FROM attendance a 
                    JOIN users u ON a.user_id = u.id 
                    JOIN events e ON a.event_id = e.event_id 
                    WHERE attendance_id = ?`
    const [rows] = await pool.query(query, [attendanceId])
    return rows[0]
}

export const markAttendance = async (userId, eventId, status = 'Present') => {
    const query = `INSERT INTO attendance (user_id, event_id, status) 
                    VALUES (?, ?, ?)`
    const [rows] = await pool.query(query, [userId, eventId, status])
    return rows
}

export const updateAttendance = async (attendanceId, status) => {
    const query = `UPDATE attendance SET status = ? WHERE attendance_id = ?`
    const [rows] = await pool.query(query, [status, attendanceId])
    return rows
}

export const getAttendanceSummary = async () => {
    const query = `SELECT 
                    COUNT(*) AS total,
                    SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS present_count,
                    SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) AS late_count,
                    SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) AS absent_count
                    FROM attendance`
    const [rows] = await pool.query(query)
    return rows[0]
}

export const getEventByToken = async (token) => {
    const query = `SELECT * FROM events WHERE event_token = ?`;
    const [rows] = await pool.query(query, [token]);
    return rows[0];
};

export const overrideAttendance = async (userId, eventId, status) => {
    // Check if attendance already exists
    const checkQuery = `SELECT attendance_id FROM attendance WHERE user_id = ? AND event_id = ?`;
    const [existing] = await pool.query(checkQuery, [userId, eventId]);

    if (existing.length > 0) {
        const updateQuery = `UPDATE attendance SET status = ? WHERE attendance_id = ?`;
        const [result] = await pool.query(updateQuery, [status, existing[0].attendance_id]);
        return result;
    } else {
        const insertQuery = `INSERT INTO attendance (user_id, event_id, status) VALUES (?, ?, ?)`;
        const [result] = await pool.query(insertQuery, [userId, eventId, status]);
        return result;
    }
};

export const getAttendanceSummaryByOrg = async (orgId) => {
    // Returns summary only for events that belong to the specified org
    const query = `SELECT 
                    COUNT(*) AS total,
                    SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) AS present_count,
                    SUM(CASE WHEN a.status = 'Late' THEN 1 ELSE 0 END) AS late_count,
                    SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) AS absent_count
                    FROM attendance a
                    JOIN events e ON a.event_id = e.event_id
                    WHERE e.organization_id = ?`;
    const [rows] = await pool.query(query, [orgId]);
    return rows[0];
};