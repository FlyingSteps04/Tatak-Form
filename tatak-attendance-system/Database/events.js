import { pool } from '../Database/connection.js'

export const getAllEvents = async () => {
    const query = `SELECT * FROM events`
    const [rows] = await pool.query(query)
    return rows
}

export const getEventByID = async (id) => {
    const query = `SELECT * FROM events WHERE event_id = ?`
    const [rows] = await pool.query(query, [id])
    return rows[0]
}

export async function addEvent(org_id, name, location, latitude, longitude, start_date, end_date, user_id, qrCodeImage, eventToken, approval_status = 'Approved', expected_attendance = null) {
    
    console.log("CHECKPOINT 2 (Database): Token is ->", eventToken);
    console.log("CHECKPOINT 2 (Database): QR Code is ->", qrCodeImage ? "RECEIVED" : "EMPTY");

    const [result] = await pool.query(
        `INSERT INTO events 
        (organization_id, name, location, latitude, longitude, start_date, end_date, created_by, qr_code, event_token, approval_status, expected_attendance) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [org_id, name, location, latitude, longitude, start_date, end_date, user_id, qrCodeImage, eventToken, approval_status, expected_attendance]
    );
    
    return result;
}
export const updateEvent = async (eventID, name, location, latitude, longitude, start_date, end_date, created_by, expected_attendance, organization_id) => {
    const query = `UPDATE events SET name = ?, location = ?, latitude = ?, longitude = ?, 
                    start_date = ?, end_date = ?, created_by = ?, expected_attendance = ?, organization_id = ? WHERE event_id = ?`
    const [result] = await pool.query(query, [name, location, latitude, longitude, start_date, end_date, created_by, expected_attendance, organization_id, eventID])
    return result
}

export const deleteEvent = async (eventID) => {
    const query = `DELETE FROM events WHERE event_id = ?`
    const [result] = await pool.query(query, [eventID])
    return result
}

export const approveEvent = async (eventID) => {
    const query = `UPDATE events SET approval_status = 'Approved' WHERE event_id = ?`;
    const [result] = await pool.query(query, [eventID]);
    return result;
}

