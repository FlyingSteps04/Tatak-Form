import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
dotenv.config()

export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]

    if(!token) return res.status(401).json({error: "No token provided!"})
    
    jwt.verify(token, process.env.SECRET_KEY, (err, user) => {
        if(err) return res.status(403).json({error: "Invalid Token"})
        req.user = user
        next()
    })
}

export const authenticateRole = (...roles) => {
    return (req, res, next) => {
        if(!roles.includes(req.user.role)){
            return res.status(403).json({error: "Access Denied"})
        }
        next()
    }
}