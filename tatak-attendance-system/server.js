    import express from 'express'
    import authRoute from './Routes/authentication.js'
    import organizationRoute from './Routes/organizations.js'
    import officerRoute from './Routes/officers.js'
    import eventsRoute from './Routes/events.js'
    import attendanceRoute from './Routes/attendance.js'
    import logsRoute from './Routes/auditLogs.js'
    import notificationRoute from './Routes/notifications.js'
    import studentRoute from './Routes/students.js'
    import dotenv from 'dotenv'
    import cors from 'cors';
    import path from 'path'
    dotenv.config()

    const app = express()
    app.use(cors());
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));
    const PORT = process.env.PORT || 3002

    app.use('/auth', authRoute)
    app.use('/organizations', organizationRoute)
    app.use('/officers', officerRoute)
    app.use('/events', eventsRoute)
    app.use('/attendance', attendanceRoute)
    app.use('/logs', logsRoute)
    app.use('/notifications', notificationRoute)
    app.use('/students', studentRoute)
    app.use('/qr', express.static(path.join(process.cwd(), 'qr')));
    app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
    app.use((err, req, res, next) => {
        console.error(err.stack);
        res.status(500).json({ message: "Something went wrong!", error: err.message });
    });

    app.listen(PORT, () => {console.log(`Server is running on port ${PORT}`)})

