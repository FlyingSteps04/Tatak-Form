import { pool } from '../Database/connection.js'

export const getAllOrganizations = async (onlyActive = false) => {
    const query = onlyActive ? `SELECT * FROM organizations WHERE is_active = 1` : `SELECT * FROM organizations`
    const [rows] = await pool.query(query)
    return rows
}

export const getOrganizationByID = async (organizationId) => {
    const query = `SELECT * FROM organizations WHERE organization_id = ?`
    const [rows] = await pool.query(query, [organizationId])
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
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        // 1. Delete attendance records for all events belonging to this org
        await connection.query(`
            DELETE a FROM attendance a
            JOIN events e ON a.event_id = e.event_id
            WHERE e.organization_id = ?
        `, [organizationId]);

        // 2. Delete events belonging to this org
        await connection.query(`DELETE FROM events WHERE organization_id = ?`, [organizationId]);

        // 3. Delete officer records for this org
        await connection.query(`DELETE FROM organization_officer WHERE organization_id = ?`, [organizationId]);

        // 4. Clear organization association for all users (students)
        await connection.query(`UPDATE users SET organization_id = NULL WHERE organization_id = ?`, [organizationId]);

        // 5. Finally delete the organization itself
        const [result] = await connection.query(`DELETE FROM organizations WHERE organization_id = ?`, [organizationId]);

        await connection.commit();
        return result;
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

export const updateOrganization = async (organizationId, name, description, is_active) => {
    const query = `UPDATE organizations SET name = ?, description = ?, is_active = ? WHERE organization_id = ?`
    const [result] = await pool.query(query, [name, description, is_active === undefined ? 1 : is_active, organizationId])
    return result
}