import { NextRequest, NextResponse } from 'next/server';
import { registerUser, setSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { full_name, email, role_id, password } = await req.json();

    if (!full_name || !email || !role_id) {
      return NextResponse.json(
        { error: 'Full name, email, and role are required.' },
        { status: 400 }
      );
    }

    const numericRoleId = Number(role_id);
    if (![1, 2, 3].includes(numericRoleId)) {
      return NextResponse.json({ error: 'Invalid role selected.' }, { status: 400 });
    }

    const user = await registerUser(full_name, email, numericRoleId, password);
    await setSession(user);

    return NextResponse.json({ success: true, user });
  } catch (err: any) {
    console.error('Registration error:', err);
    return NextResponse.json({ error: err.message || 'Registration failed' }, { status: 400 });
  }
}
