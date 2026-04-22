import { pool } from '../Database/connection.js'

export const saveResetToken = async (userId, token, expiresAt) => {
  const query = `INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)`
  await pool.query(query, [userId, token, expiresAt])
}

export const getResetToken = async (token) => {
  const query = `SELECT * FROM password_resets WHERE token = ?`
  const [rows] = await pool.query(query, [token])
  return rows[0]
}

export const deleteResetToken = async (token) => {
  const query = `DELETE FROM password_resets WHERE token = ?`
  await pool.query(query, [token])
}