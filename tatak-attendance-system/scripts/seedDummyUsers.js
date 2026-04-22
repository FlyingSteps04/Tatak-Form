import bcrypt from 'bcryptjs';
import { pool } from '../Database/connection.js';
import { getUserByIdentifier, addUser } from '../Database/users.js';

/**
 * Creates (or updates) a user record so you can log in immediately.
 * - If the user already exists (matched by stud_id_number OR email OR username),
 *   we update their password + role + basic fields.
 * - If the user does not exist, we insert a new row.
 */
async function upsertUser({ stud_id_number = null, fname, email, username, password, role }) {
  const existing =
    (stud_id_number && (await getUserByIdentifier(stud_id_number))) ||
    (email && (await getUserByIdentifier(email))) ||
    (username && (await getUserByIdentifier(username)));

  const hashedPassword = await bcrypt.hash(password, 10);

  if (!existing) {
    await addUser(stud_id_number, fname, email, username, hashedPassword, role);
    return { action: 'created' };
  }

  // Update the existing row to match the requested dummy account values.
  await pool.query(
    `UPDATE users
     SET stud_id_number = ?, fname = ?, email = ?, username = ?, password = ?, role = ?
     WHERE id = ?`,
    [stud_id_number, fname, email, username, hashedPassword, role, existing.id]
  );

  return { action: 'updated' };
}

/**
 * Seeds the database with the exact dummy accounts requested.
 * This is safe to run multiple times; it will update existing users.
 */
async function seedDummyAccounts() {
  const accounts = [
    {
      // Student account (uses stud_id_number as login identifier).
      stud_id_number: '123456',
      fname: 'Dummy Student',
      email: 'student123456@uc.edu.ph',
      username: 'student_123456',
      password: 'sqwerty123',
      role: 'Student',
    },
    {
      // Officer account (login by username).
      stud_id_number: null,
      fname: 'Dummy Officer',
      email: 'barda123@uc.edu.ph',
      username: 'Barda123',
      password: 'Giatay',
      role: 'Officer',
    },
    {
      // Admin account (login by email).
      stud_id_number: null,
      fname: 'Dummy Admin',
      email: 'admin@uc.edu.ph',
      username: 'admin',
      password: 'Poster',
      role: 'Admin',
    },
  ];

  for (const account of accounts) {
    const result = await upsertUser(account);
    console.log(`[seed] ${account.role} ${result.action}: ${account.email || account.username || account.stud_id_number}`);
  }
}

// Run the script.
seedDummyAccounts()
  .then(() => {
    console.log('[seed] Done.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[seed] Failed:', err);
    process.exit(1);
  });

