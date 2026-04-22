import { pool } from '../Database/connection.js'

export const getAllOrganizationOfficers = async () => {
    const query = `SELECT oo.officer_id, u.fname, u.role, o.name, u.id AS user_id,
                          oo.position, oo.term_start, oo.term_end, oo.status
                    FROM organization_officer oo 
                    JOIN users u ON oo.user_id = u.id 
                    JOIN organizations o ON oo.organization_id = o.organization_id`;
    const [rows] = await pool.query(query)
    return rows
}

export const getOrganizationOfficerByID = async (officerId) => {
    const query = `SELECT oo.officer_id, u.fname, u.role, o.name, u.id AS user_id,
                          oo.position, oo.term_start, oo.term_end, oo.status
                    FROM organization_officer oo 
                    JOIN users u ON oo.user_id = u.id 
                    JOIN organizations o ON oo.organization_id = o.organization_id 
                    WHERE oo.officer_id = ?`
    const [rows] = await pool.query(query, [officerId])
    return rows[0]
}

export const addOrganizationOfficer = async (organizationId, userID, position = 'Officer', termStart = null, termEnd = null, status = 'Active') => {
    const query = `INSERT INTO organization_officer (organization_id, user_id, position, term_start, term_end, status) 
                    SELECT ?, u.id, ?, ?, ?, ? FROM users u WHERE u.id = ? AND u.role = 'Officer'`
    // Corrected parameter order: userID is used once for the SELECT u.id (calculated by DB) and once for the WHERE u.id = ?
    // Wait, the SELECT actually uses u.id from the table, not a placeholder.
    // The placeholders are: 1(org_id), 2(position), 3(term_start), 4(term_end), 5(status), 6(user_id for WHERE)
    const [rows] = await pool.query(query, [organizationId, position, termStart, termEnd, status, userID])
    return rows
}

export const updateOrganizationOfficer = async (officerId, organizationId, position, status) => {
    const query = `UPDATE organization_officer SET organization_id = ?, position = ?, status = ? WHERE officer_id = ?`
    const [result] = await pool.query(query, [organizationId, position, status, officerId])
    return result
}

export const deleteOrganizationOfficer = async (officerId) => {
    const query = `DELETE FROM organization_officer WHERE officer_id = ?`
    const [result] = await pool.query(query, [officerId])
    return result
}
