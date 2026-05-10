import { pool } from './connection.js'

export const getAllStudents = async () => {
    const role = 'Student'
    const query = `SELECT * FROM users WHERE role = ?`
    const [rows] = await pool.query(query, [role])
    return rows
}

export const getAllUsers = async () => {
    const query = `SELECT id, stud_id_number, fname, email, username, role, organization_id, profile_picture, created_at FROM users`
    const [rows] = await pool.query(query)
    return rows
}

export const getUserByID = async (id) => {
    const query = `SELECT * FROM users WHERE id = ?`
    const [rows] = await pool.query(query, [id])
    return rows[0]
}

export const getUserByIdentifier = async (identifier) => {
    const query = `SELECT * FROM users WHERE stud_id_number = ? OR email = ? OR username = ?`
    const [rows] = await pool.query(query, [identifier, identifier, identifier])
    return rows[0]
}

export const addUser = async (stud_id_number = null, fname, email, username, password, role, organization_id = null, profile_picture = null) => {
    const query = `INSERT INTO users (stud_id_number, fname, email, username, password, role, organization_id, profile_picture) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    const [result] = await pool.query(query, [stud_id_number, fname, email, username, password, role, organization_id, profile_picture])
    return result
}

export const updateStudent = async (id, newPassword) => {
    const query = `UPDATE users SET password = ? WHERE id = ?`
    const [result] = await pool.query(query, [newPassword, id])
    return result
}

export const deleteUser = async (id) => {
    const query = `DELETE FROM users WHERE id = ?`
    const [result] = await pool.query(query, [id])
    return result
}

export const deleteUserRecursive = async (id) => {
    const connection = await pool.getConnection()
    try {
        await connection.beginTransaction()

        // 1. Delete records in dependent tables
        await connection.query('DELETE FROM audit_logs WHERE user_id = ?', [id])
        await connection.query('DELETE FROM notifications WHERE user_id = ?', [id])
        await connection.query('DELETE FROM organization_officer WHERE user_id = ?', [id])
        await connection.query('DELETE FROM password_resets WHERE user_id = ?', [id])
        await connection.query('DELETE FROM attendance WHERE user_id = ?', [id])

        // 2. Handle events created by this user
        // Delete attendance for events created by this user first to avoid FK issues
        await connection.query('DELETE FROM attendance WHERE event_id IN (SELECT event_id FROM events WHERE created_by = ?)', [id])
        await connection.query('DELETE FROM events WHERE created_by = ?', [id])

        // 3. Finally delete the user
        const [result] = await connection.query('DELETE FROM users WHERE id = ?', [id])
        
        await connection.commit()
        return result
    } catch (err) {
        await connection.rollback()
        throw err
    } finally {
        connection.release()
    }
}

export const deleteStudent = deleteUserRecursive;
export const deleteOfficer = deleteUserRecursive;

export const updateUser = async (id, data) => {
    const fields = Object.keys(data).map(key => `${key} = ?`).join(', ')
    const values = Object.values(data)
    const query = `UPDATE users SET ${fields} WHERE id = ?`
    const [result] = await pool.query(query, [...values, id])
    return result
}