import { pool } from './connection.js'

export const getAllStudents = async () => {
    const role = 'Student'
    const query = `SELECT * FROM users WHERE role = ?`
    const [rows] = await pool.query(query, [role])
    return rows
}

export const getAllUsers = async () => {
    const query = `SELECT id, stud_id_number, fname, email, username, role, organization_id, created_at FROM users`
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

export const addUser = async (stud_id_number = null, fname, email, username, password, role, organization_id = null) => {
    const query = `INSERT INTO users (stud_id_number, fname, email, username, password, role, organization_id) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)`
    const [result] = await pool.query(query, [stud_id_number, fname, email, username, password, role, organization_id])
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

export const deleteStudent = deleteUser;
export const deleteOfficer = deleteUser;

export const updateUser = async (id, data) => {
    const fields = Object.keys(data).map(key => `${key} = ?`).join(', ')
    const values = Object.values(data)
    const query = `UPDATE users SET ${fields} WHERE id = ?`
    const [result] = await pool.query(query, [...values, id])
    return result
}
