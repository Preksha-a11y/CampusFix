import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getMongoIncidentAnalytics } from '@/lib/mongo';

export async function GET() {
  try {
    // 1. Query View: view_department_analytics + compute Bottleneck Factor
    const deptRes = await query(`
      SELECT 
        vda.department_id,
        vda.department_name,
        vda.total_complaints,
        vda.pending_complaints,
        vda.resolved_complaints,
        vda.rejected_complaints,
        vda.avg_resolution_hours,
        vda.avg_satisfaction_rating,
        COALESCE(tech_counts.tech_count, 1) AS active_technicians,
        COALESCE(cat_avg.avg_target_hours, 12.0) AS avg_target_hours,
        COALESCE(in_prog.in_prog_count, 0) AS in_progress_complaints
      FROM view_department_analytics vda
      LEFT JOIN (
        SELECT cat.department_id, COUNT(DISTINCT a.staff_id) AS tech_count
        FROM complaints c
        JOIN categories cat ON c.category_id = cat.category_id
        JOIN assignments a ON c.complaint_id = a.complaint_id AND a.ended_at IS NULL
        GROUP BY cat.department_id
      ) tech_counts ON vda.department_id = tech_counts.department_id
      LEFT JOIN (
        SELECT department_id, AVG(target_hours) AS avg_target_hours
        FROM categories
        GROUP BY department_id
      ) cat_avg ON vda.department_id = cat_avg.department_id
      LEFT JOIN (
        SELECT cat.department_id, COUNT(c.complaint_id) AS in_prog_count
        FROM complaints c
        JOIN categories cat ON c.category_id = cat.category_id
        WHERE c.status = 'IN_PROGRESS'
        GROUP BY cat.department_id
      ) in_prog ON vda.department_id = in_prog.department_id
      ORDER BY vda.department_id ASC;
    `);

    // Compute SLA Compliance % and Department Bottleneck Factor (BF_d)
    const departmentAnalytics = deptRes.rows.map((row: any) => {
      const pending = Number(row.pending_complaints || 0);
      const resolved = Number(row.resolved_complaints || 0);
      const total = Number(row.total_complaints || 0);
      const techs = Math.max(1, Number(row.active_technicians || 1));
      const avgHours = row.avg_resolution_hours ? Number(row.avg_resolution_hours) : 0;
      const targetHours = Number(row.avg_target_hours || 12);

      // Idea 2 Bottleneck Factor Formula:
      // BF_d = 1.0 + (Pending / Techs * 0.2) + max(0, (AvgHours - TargetHours) / TargetHours)
      const workloadTerm = (pending / techs) * 0.2;
      const delayTerm = avgHours > targetHours ? (avgHours - targetHours) / targetHours : 0;
      const bottleneckFactor = Number((1.0 + workloadTerm + delayTerm).toFixed(2));

      const complianceRate = total > 0 ? Number(((resolved / total) * 100).toFixed(1)) : 100.0;

      return {
        department_id: row.department_id,
        department_name: row.department_name,
        total_complaints: total,
        pending_complaints: pending,
        in_progress_complaints: Number(row.in_progress_complaints || 0),
        resolved_complaints: resolved,
        rejected_complaints: Number(row.rejected_complaints || 0),
        avg_resolution_hours: row.avg_resolution_hours ? Number(row.avg_resolution_hours) : null,
        avg_satisfaction_rating: row.avg_satisfaction_rating ? Number(row.avg_satisfaction_rating) : null,
        sla_compliance_rate_pct: complianceRate,
        bottleneck_factor: bottleneckFactor,
      };
    });

    // 2. Query View: view_pending_complaints (All pending + Overdue flags)
    const pendingRes = await query(`
      SELECT 
        complaint_id,
        title,
        priority,
        status,
        department_name,
        category_name,
        target_hours,
        hours_open,
        is_overdue,
        staff_name AS assigned_staff_name,
        reporter_name
      FROM view_pending_complaints
      ORDER BY hours_open DESC;
    `);

    // 3. Query MongoDB for community upvote aggregations
    const mongoAnalytics = await getMongoIncidentAnalytics();

    return NextResponse.json({
      success: true,
      department_analytics: departmentAnalytics,
      pending_complaints: pendingRes.rows,
      mongo_analytics: mongoAnalytics,
    });
  } catch (err: any) {
    console.error('Error in analytics endpoint:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
