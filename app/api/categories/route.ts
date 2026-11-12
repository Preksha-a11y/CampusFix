import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const res = await query(`
      SELECT 
        c.category_id,
        c.category_name,
        c.target_hours,
        d.department_id,
        d.department_name
      FROM categories c
      JOIN departments d ON c.department_id = d.department_id
      ORDER BY d.department_name, c.category_name
    `);
    return NextResponse.json({ categories: res.rows });
  } catch (err: any) {
    console.error('Error fetching categories:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
