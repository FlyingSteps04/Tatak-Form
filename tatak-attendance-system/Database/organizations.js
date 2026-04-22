import { pool } from '../Database/connection.js'

export const getAllOrganizations = async () => {
    const query = `SELECT * FROM organizations WHERE is_active = ?`
    const [rows] = await pool.query(query, [1])
    return rows
}

export const getOrganizationByID = async (organizationId) => {
    const query = `SELECT * FROM organizations WHERE organization_id = ? AND is_active = ?`
    const [rows] = await pool.query(query, [organizationId, 1])
    return rows[0]
}

export const addOrganization = async (name, description) => {
    const query = `INSERT INTO organizations (name, description) VALUES (?,?)`
    const [rows] = await pool.query(query, [name, description])
    return rows
}

// Allows specifying a custom organization_id; if null/undefined, auto-increment is used
export const addOrganizationWithId = async (customId, name, description) => {
    if (customId) {
        const query = `INSERT INTO organizations (organization_id, name, description) VALUES (?,?,?)`
        const [rows] = await pool.query(query, [customId, name, description])
        return rows
    }
    return addOrganization(name, description)
}

export const deleteOrganization = async (organizationId) => {
    const query = `UPDATE organizations SET is_active = ? WHERE organization_id = ?`
    const [result] = await pool.query(query, [0, organizationId])
    return result
}

export const updateOrganization = async (organizationId, name, description) => {
    const query = `UPDATE organizations SET name = ?, description = ? WHERE organization_id = ?`
    const [result] = await pool.query(query, [name, description, organizationId])
    return result
}