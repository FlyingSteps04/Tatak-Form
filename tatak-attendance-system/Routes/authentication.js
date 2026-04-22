import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import sgMail from '@sendgrid/mail'
sgMail.setApiKey(process.env.SG_API_KEY)
import crypto from 'crypto'
import { addUser, deleteUser, getAllUsers, getUserByID, getUserByIdentifier, updateStudent } from '../Database/users.js'
import { authenticateRole, authenticateToken } from '../Middleware/authentication.js'
import { saveResetToken, getResetToken, deleteResetToken } from '../Database/resetTokens.js'
import { addNotification } from '../Database/notifications.js'
import dotenv from 'dotenv'
dotenv.config()

const router = express.Router()

router.post('/register', async (req, res) => {
    const { stud_id_number, fname, email, username, password, role } = req.body
    
    const validRoles = ['Student', 'Admin', 'Officer']
    if(!validRoles.includes(role)) res.status(400).json({error: "Invalid Role!"})

    if(role==='Student' && !stud_id_number) res.status(400).json({error: "Student ID is required!"})
    
    const hashedPassword = await bcrypt.hash(password, 10)
    const newUserID = await addUser(stud_id_number, fname, email, username, hashedPassword, role)
    res.status(201).json({message: "User Created", id: newUserID.insertId})
})

router.post('/login', async (req, res) => {
    const { identifier, password } = req.body
    const user = await getUserByIdentifier(identifier)
    
    if(!user) return res.status(404).json({message:"No user Found!"})

    const isMatch = await bcrypt.compare(password, user.password)
    if(!isMatch) return res.status(403).json({message: "Incorrect Password!"})

    const token = jwt.sign({id: user.id, role: user.role}, process.env.SECRET_KEY, {expiresIn: '1h'})
    res.json({token, role: user.role})
})

router.post('/logout', authenticateToken, async (req, res) => {
    res.json({message: "Logged out Successfully. Please remove token on client side!"})
})

router.get('/me', authenticateToken, async (req, res) => {
    const user = await getUserByID(req.user.id)
    res.json({id: user.id, role: user.role})
})

router.get('/users', authenticateToken, authenticateRole("Admin"), async (req, res) => {
    const users = await getAllUsers()
    res.json({ success: true, data: users })
})

router.put('/change-password', authenticateToken, authenticateRole("Student"), async (req, res) => {
    const { oldPassword, newPassword} = req.body
    const user = await getUserByID(req.user.id)

    const isMatch = await bcrypt.compare(oldPassword, user.password)
    if(!isMatch) return res.status(403).json({error: "Invalid password"})

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await updateStudent(req.user.id, hashedPassword)
    await addNotification(req.user.id, "Password Changed", "Your account password was successfully changed.")

    res.json({message: "Password updated successfully"})
})

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body
  const user = await getUserByIdentifier(email)
  if (!user) return res.status(404).json({ error: "User not found" })

  const resetToken = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

  await saveResetToken(user.id, resetToken, expiresAt)

  const resetLink = `http://localhost:3002/reset-password?token=${resetToken}`

  const msg = {
    to: email,
    from: process.env.EMAIL_USER,
    subject: "Password Reset Request",
    text: `Click here to reset your password: ${resetLink}`,
    html: `<p>Click <a href="${resetLink}">here</a> to reset your password.</p>` 
  }
  try {
    await sgMail.send(msg)
    res.json({message: "Password reset email sent"})
  } catch (error) {
    res.status(500).json({error: error.message})
  }
})

router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body

  const resetRecord = await getResetToken(token)
  if (!resetRecord) return res.status(400).json({ error: "Invalid token" })

  if (new Date(resetRecord.expires_at) < new Date()) {
    return res.status(400).json({ error: "Token expired" })
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10)
  await updateStudent(resetRecord.user_id, hashedPassword)
  await addNotification(resetRecord.user_id, "Password Changed", "Your account password was successfully changed.")

  await deleteResetToken(token)

  res.json({ message: "Password reset successfully" })
})

router.delete('/users/:id', authenticateToken, authenticateRole("Admin"), async (req, res) => {
    const { id } = req.params
    try {
        const result = await deleteUser(id)
        if (!result.affectedRows) return res.status(404).json({ success: false, error: "User not found" })
        res.json({ success: true, message: "User deleted successfully" })
    } catch (err) {
        console.error('DELETE /auth/users/:id error:', err)
        res.status(500).json({ success: false, error: "Server error" })
    }
})

export default router
