import { MongoClient, Db, Collection } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campusfix_nosql';

export async function getMongoDb(): Promise<Db> {
  if (!db) {
    client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    await client.connect();
    db = client.db('campusfix_nosql');
  }
  return db;
}

export interface ComplaintDocument {
  complaint_id: number;
  title: string;
  description: string;
  category: string;
  department: string;
  extracted_keywords: string[];
  image_url?: string | null;
  metadata: {
    location: string;
    priority: string;
    status: string;
    upvote_count: number;
    affected_users: number[];
    locations: string[];
    last_technician_remark?: string | null;
    updated_at?: Date;
  };
  created_at: Date;
}

export async function getComplaintCollection(): Promise<Collection<ComplaintDocument>> {
  const database = await getMongoDb();
  return database.collection<ComplaintDocument>('complaint_documents');
}

export function extractKeywords(text: string): string[] {
  const words = (text.toLowerCase().match(/[a-zA-Z0-9]{3,}/g) || []);
  const stopWords = new Set(['the', 'and', 'for', 'with', 'from', 'room', 'floor', 'hall', 'area', 'near', 'this', 'that']);
  return Array.from(new Set(words.filter(w => !stopWords.has(w)))).slice(0, 10);
}

// 1. Sync / Insert complaint document
export async function syncComplaintToMongo(data: {
  complaint_id: number | string;
  title: string;
  description: string;
  category: string;
  department: string;
  location: string;
  priority: string;
  status: string;
  reporter_id: number | string;
}) {
  try {
    const col = await getComplaintCollection();
    const numId = Number(data.complaint_id);
    const repId = Number(data.reporter_id);
    const keywords = extractKeywords(`${data.title} ${data.description}`);
    const doc: ComplaintDocument = {
      complaint_id: numId,
      title: data.title,
      description: data.description,
      category: data.category,
      department: data.department,
      extracted_keywords: keywords,
      image_url: null,
      metadata: {
        location: data.location,
        priority: data.priority,
        status: data.status,
        upvote_count: 1,
        affected_users: [repId],
        locations: [data.location],
        updated_at: new Date(),
      },
      created_at: new Date(),
    };
    await col.updateOne(
      { complaint_id: numId },
      { $set: doc },
      { upsert: true }
    );
  } catch (err) {
    console.error('MongoDB sync error:', err);
  }
}

// 2. IDEA 1: Atomic Upvote in MongoDB
export async function upvoteComplaintInMongo(complaint_id: number | string, user_id: number | string, location: string) {
  try {
    const col = await getComplaintCollection();
    const numId = Number(complaint_id);
    const numUserId = Number(user_id);
    const result = await col.findOneAndUpdate(
      { complaint_id: numId },
      {
        $inc: { 'metadata.upvote_count': 1 },
        $addToSet: {
          'metadata.affected_users': numUserId,
          'metadata.locations': location,
        },
        $set: { 'metadata.updated_at': new Date() },
      },
      { returnDocument: 'after' }
    );
    return result;
  } catch (err) {
    console.error('MongoDB upvote error:', err);
    throw err;
  }
}

// 3. Update status in MongoDB
export async function updateComplaintStatusInMongo(complaint_id: number | string, new_status: string, remark?: string) {
  try {
    const col = await getComplaintCollection();
    const numId = Number(complaint_id);
    await col.updateOne(
      { complaint_id: numId },
      {
        $set: {
          'metadata.status': new_status,
          'metadata.last_technician_remark': remark || null,
          'metadata.updated_at': new Date(),
        },
      }
    );
  } catch (err) {
    console.error('MongoDB status update error:', err);
  }
}

// 4. Delete complaint in MongoDB
export async function deleteComplaintFromMongo(complaint_id: number | string) {
  try {
    const col = await getComplaintCollection();
    const numId = Number(complaint_id);
    await col.deleteOne({ complaint_id: numId });
  } catch (err) {
    console.error('MongoDB delete error:', err);
  }
}

// 5. MongoDB Aggregation: Top Upvoted and Category Analysis
export async function getMongoIncidentAnalytics() {
  try {
    const col = await getComplaintCollection();
    const topUpvoted = await col.find().sort({ 'metadata.upvote_count': -1 }).limit(5).toArray();
    const categoryAgg = await col.aggregate([
      {
        $group: {
          _id: '$category',
          total_reports: { $sum: 1 },
          total_upvotes: { $sum: '$metadata.upvote_count' },
        },
      },
      { $sort: { total_upvotes: -1 } },
    ]).toArray();
    return { topUpvoted, categoryAgg };
  } catch (err) {
    console.error('MongoDB aggregation error:', err);
    return { topUpvoted: [], categoryAgg: [] };
  }
}
