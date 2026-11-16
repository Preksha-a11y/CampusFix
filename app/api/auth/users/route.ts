import { NextResponse } from 'next/server';
import { getAllUsers } from '@/lib/auth';

export async function GET() {
  try {
    const users = await getAllUsers();
    return NextResponse.json({ success: true, users });
  } catch (err: any) {
    console.error('Error fetching users:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch users' }, { status: 500 });
  }
}
