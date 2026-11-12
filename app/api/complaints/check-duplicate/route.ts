import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { generateEmbedding, toVectorString } from '@/lib/vector';
import { getComplaintCollection } from '@/lib/mongo';

export async function POST(req: NextRequest) {
  try {
    const { title, description, location_text } = await req.json();
    if (!title) {
      return NextResponse.json({ duplicates: [] });
    }

    const fullText = `${title} ${description || ''} ${location_text || ''}`;
    const vec = generateEmbedding(fullText);
    const vecStr = toVectorString(vec);

    // Query top similar active complaints using pgvector Cosine distance (<=>)
    const res = await query(
      `SELECT 
        c.complaint_id,
        c.title,
        c.description,
        c.location_text AS location,
        c.status,
        c.priority,
        cat.category_name,
        d.department_name,
        ROUND((1 - (ce.embedding <=> $1::vector))::numeric, 4) AS similarity_score
       FROM complaint_embeddings ce
       JOIN complaints c ON ce.complaint_id = c.complaint_id
       JOIN categories cat ON c.category_id = cat.category_id
       JOIN departments d ON cat.department_id = d.department_id
       WHERE c.status NOT IN ('REJECTED')
       ORDER BY ce.embedding <=> $1::vector
       LIMIT 4`,
      [vecStr]
    );

    // Filter to matches >= 0.50 (50%)
    const candidates = res.rows.filter(r => Number(r.similarity_score) >= 0.50);

    // Enrich with MongoDB upvote and community report count
    if (candidates.length > 0) {
      try {
        const col = await getComplaintCollection();
        const ids = candidates.map(c => c.complaint_id);
        const mongoDocs = await col.find({ complaint_id: { $in: ids } }).toArray();
        const docMap = new Map(mongoDocs.map(d => [d.complaint_id, d]));

        const enriched = candidates.map(c => {
          const doc = docMap.get(c.complaint_id);
          return {
            ...c,
            similarity_pct: Math.round(Number(c.similarity_score) * 100),
            upvote_count: doc?.metadata?.upvote_count || 1,
            affected_count: doc?.metadata?.affected_users?.length || 1,
            additional_locations: doc?.metadata?.locations || [c.location],
          };
        });
        return NextResponse.json({ duplicates: enriched });
      } catch {
        return NextResponse.json({
          duplicates: candidates.map(c => ({
            ...c,
            similarity_pct: Math.round(Number(c.similarity_score) * 100),
            upvote_count: 1,
          })),
        });
      }
    }

    return NextResponse.json({ duplicates: [] });
  } catch (err: any) {
    console.error('Error checking duplicate:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
