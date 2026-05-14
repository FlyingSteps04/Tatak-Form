import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

export const pool = mysql.createPool({
    host: process.env.SAS_Host,
    port: 4000,
    user: process.env.SAS_User,
    password: process.env.SAS_Password,
    database: process.env.SAS_Database,
    ssl: {
        rejectUnauthorized: false
    },
    timezone: '+00:00',
    enableKeepAlive: true
})