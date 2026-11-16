import { cookies } from 'next/headers';
import { query } from './db';
import bcrypt from 'bcryptjs';

export interface UserSession {
  user_id: number;
  full_name: string;
  email: string;
  role_id: number;
  role_name: 'REPORTER' | 'STAFF' | 'ADMIN';
}

const SESSION_COOKIE_NAME = 'campusfix_session';

export async function getSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }
  try {
    const data = JSON.parse(sessionCookie.value);
    return data as UserSession;
  } catch {
    return null;
  }
}

export async function setSession(user: UserSession) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function authenticateUser(email: string, passwordInput?: string): Promise<UserSession | null> {
  const res = await query(
    `SELECT u.user_id, u.full_name, u.email, u.password_hash, u.is_active, u.role_id, r.role_name
     FROM users u
     JOIN roles r ON u.role_id = r.role_id
     WHERE LOWER(u.email) = LOWER($1) AND u.is_active = TRUE`,
    [email.trim()]
  );

  if (res.rows.length === 0) {
    return null;
  }

  const user = res.rows[0];

  // If no password provided (e.g. 1-click persona switch), authenticate directly
  if (!passwordInput) {
    return {
      user_id: user.user_id,
      full_name: user.full_name,
      email: user.email,
      role_id: user.role_id,
      role_name: user.role_name,
    };
  }

  // Verify password: either bcrypt compare or demo password match ('password123' / 'forDBMSsem5#')
  let isMatch = false;
  try {
    isMatch = await bcrypt.compare(passwordInput, user.password_hash);
  } catch {
    if (passwordInput === 'password123' || passwordInput === 'forDBMSsem5#') {
      isMatch = true;
    }
  }

  if (!isMatch && (passwordInput === 'password123' || passwordInput === 'forDBMSsem5#')) {
    isMatch = true;
  }

  if (!isMatch) {
    return null;
  }

  return {
    user_id: user.user_id,
    full_name: user.full_name,
    email: user.email,
    role_id: user.role_id,
    role_name: user.role_name,
  };
}

export async function registerUser(
  fullName: string,
  email: string,
  roleId: number,
  passwordInput?: string
): Promise<UserSession> {
  const cleanEmail = email.trim().toLowerCase();
  const existing = await query(`SELECT user_id FROM users WHERE LOWER(email) = LOWER($1)`, [cleanEmail]);
  if (existing.rows.length > 0) {
    throw new Error('A user with this email address already exists in the campus database.');
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(passwordInput || 'password123', salt);

  const res = await query(
    `INSERT INTO users (role_id, full_name, email, password_hash, is_active)
     VALUES ($1, $2, $3, $4, 1)
     RETURNING user_id, full_name, email, role_id`,
    [roleId, fullName.trim(), cleanEmail, passwordHash]
  );

  const user = res.rows[0];
  const roleRes = await query(`SELECT role_name FROM roles WHERE role_id = $1`, [roleId]);
  const roleName = roleRes.rows[0]?.role_name || (roleId === 1 ? 'REPORTER' : roleId === 2 ? 'STAFF' : 'ADMIN');

  return {
    user_id: user.user_id,
    full_name: user.full_name,
    email: user.email,
    role_id: user.role_id,
    role_name: roleName,
  };
}

export async function getAllUsers(): Promise<UserSession[]> {
  const res = await query(
    `SELECT u.user_id, u.full_name, u.email, u.role_id, r.role_name
     FROM users u
     JOIN roles r ON u.role_id = r.role_id
     WHERE u.is_active = TRUE
     ORDER BY u.role_id ASC, u.user_id ASC`
  );
  return res.rows;
}
