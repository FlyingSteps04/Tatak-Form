import express from 'express';
import { authenticateRole, authenticateToken } from '../Middleware/authentication.js';
import { getAllStudents, deleteStudent } from '../Database/users.js';
import { addLog } from '../Database/auditLogs.js';

const router = express.Router();

// GET all students
router.get('/', authenticateToken, authenticateRole("Admin", "Officer"), async (req, res) => {
    try {
        const students = await getAllStudents();
        res.json({ success: true, data: students });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE a student
router.delete('/:id', authenticateToken, authenticateRole("Admin"), async (req, res) => {
    try {
        const { id } = req.params;
        await deleteStudent(id);
        await addLog(req.user.id, "Delete Student", "users", id);
        res.json({ success: true, message: "Student deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
