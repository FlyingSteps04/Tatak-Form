import { getEventByID } from '../Database/events.js'

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000
  const toRad = angle => (angle * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

export const validateAttendance = async (req, res, next) => {
  const { userLat, userLon } = req.body
  const { eventId } = req.params

  const event = await getEventByID(eventId)
  if (!event) return res.status(404).json({ error: "Event not found" })

  const eventLat = event.latitude
  const eventLon = event.longitude

  const distance = haversineDistance(eventLat, eventLon, parseFloat(userLat), parseFloat(userLon))

  if (distance <= 50) {
    next()
  } else {
    return res.status(400).json({ error: "User not within venue range" })
  }
}
