    import mysql from 'mysql2/promise'
    import dotenv from 'dotenv'
    dotenv.config()

    export const pool = mysql.createPool({
        host: process.env.SAS_Host,
        user: process.env.SAS_User,
        password: process.env.SAS_Password,
        database: process.env.SAS_Database
    })