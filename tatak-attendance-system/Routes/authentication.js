import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import sgMail from '@sendgrid/mail'
sgMail.setApiKey(process.env.SG_API_KEY)
import crypto from 'crypto'
import { addUser, deleteUser, deleteUserRecursive, getAllUsers, getUserByID, getUserByIdentifier, updateStudent } from '../Database/users.js'
import { authenticateRole, authenticateToken } from '../Middleware/authentication.js'
import { saveResetToken, getResetToken, deleteResetToken } from '../Database/resetTokens.js'
import { addNotification } from '../Database/notifications.js'
import dotenv from 'dotenv'
dotenv.config()
import { pool } from '../Database/connection.js'
import { processImage } from '../scripts/imageHelper.js'

const router = express.Router()

router.post('/register', async (req, res) => {
    const { stud_id_number, fname, email, username, password, role, profile_picture } = req.body
    
    const validRoles = ['Student', 'Admin', 'Officer']
    if(!validRoles.includes(role)) res.status(400).json({error: "Invalid Role!"})

    if(role==='Student' && !stud_id_number) res.status(400).json({error: "Student ID is required!"})
    
    // Convert base64 profile picture to local file path
    const finalProfilePic = processImage(profile_picture, 'profiles');
    
    const hashedPassword = await bcrypt.hash(password, 10)
    
    try {
        const { organization_id } = req.body;
        const newUserID = await addUser(stud_id_number, fname, email, username, hashedPassword, role, organization_id, finalProfilePic)
        const userId = newUserID.insertId;

        // If it's an officer, link them automatically to the organization
        if (role === 'Officer' && organization_id) {
            const { position, term_start, term_end, status } = req.body;
            await pool.query(
                "INSERT INTO organization_officer (user_id, organization_id, position, term_start, term_end, status) VALUES (?, ?, ?, ?, ?, ?)",
                [userId, organization_id, position, term_start, term_end, status || 'Active']
            );
        }

        res.status(201).json({message: "User Created and Linked", id: userId, success: true})
    } catch (err) {
        if (err.message.includes('Duplicate entry') || err.message.includes('already exists')) {
            return res.status(409).json({ error: "Username or Email already exists", code: 'ER_DUP_ENTRY' });
        }
        console.error('Registration error:', err);
        res.status(500).json({ error: "Failed to register user" });
    }
})

router.post('/login', async (req, res) => {
    const { identifier, password } = req.body
    
    try {
        // Fetch user with organization and officer status
        const [rows] = await pool.query(
            `SELECT u.*, o.is_active as org_is_active, o.name as org_name, 
                    oo.status as officer_status, oo.term_start, oo.term_end
             FROM users u
             LEFT JOIN organizations o ON u.organization_id = o.organization_id
             LEFT JOIN organization_officer oo ON u.id = oo.user_id
             WHERE u.stud_id_number = ? OR u.email = ? OR u.username = ?`,
            [identifier, identifier, identifier]
        )
        
        const user = rows[0]
        
        if(!user) return res.status(404).json({message:"No user Found!"})

        const isMatch = await bcrypt.compare(password, user.password)
        if(!isMatch) return res.status(403).json({message: "Incorrect Password!"})

        // Check if organization is inactive (for Student and Officer roles)
        if (user.role !== 'Admin' && user.organization_id) {
            if (user.org_is_active === 0) {
                return res.status(403).json({ 
                    message: `Login failed: The organization "${user.org_name || 'N/A'}" is currently inactive. Please contact your administrator.` 
                });
            }
        }

        // Check if officer account is inactive or out of term
        if (user.role === 'Officer') {
            if (user.officer_status === 'Inactive') {
                return res.status(403).json({ 
                    message: "Login failed: Your officer account is currently inactive. Please contact your administrator." 
                });
            }

            const now = new Date();
            if (user.term_start && now < new Date(user.term_start)) {
                return res.status(403).json({ 
                    message: `Login failed: Your term has not yet started. Your access begins on ${new Date(user.term_start).toLocaleDateString()}.` 
                });
            }
            if (user.term_end && now > new Date(user.term_end)) {
                return res.status(403).json({ 
                    message: "Login failed: Your term has already expired. Please contact your administrator." 
                });
            }
        }

        const token = jwt.sign({id: user.id, role: user.role}, process.env.SECRET_KEY, {expiresIn: '1h'})
        res.json({token, role: user.role})
    } catch (err) {
        console.error('Login error:', err)
        res.status(500).json({ message: "Server error during login" })
    }
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
  const { id } = req.body
  const user = await getUserByIdentifier(id)
  if (!user) return res.status(404).json({ error: "User not found" })

  const resetToken = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

  await saveResetToken(user.id, resetToken, expiresAt)

  const msg = {
    to: user.email,
    from: process.env.EMAIL_USER,
    subject: "Password Reset Request",
    text: `Your Code is: ${resetToken}`,
    html: `<p>Enter this code <b>${resetToken}</b> to reset your password.</p>` 
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

  if (!token || !newPassword) {
    return res.status(400).json({ error: "Token and new password are required" })
  }

  const resetRecord = await getResetToken(token)
  if (!resetRecord) {
    return res.status(400).json({ error: "Invalid code" })
  }

  if (new Date(resetRecord.expires_at) < new Date()) {
    await deleteResetToken(token)
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
        const result = await deleteUserRecursive(id)
        if (!result.affectedRows) return res.status(404).json({ success: false, error: "User not found" })
        res.json({ success: true, message: "User and all related records deleted successfully" })
    } catch (err) {
        console.error('DELETE /auth/users/:id error:', err)
        res.status(500).json({ success: false, error: "Server error during deletion" })
    }
})

export default router
