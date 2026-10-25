/**
 * CampusFix: Intelligent Campus Complaint Management and Resolution System
 * MongoDB NoSQL Document Model & Aggregation Script
 * Component: Unstructured complaint documents, image attachments, extracted keywords
 * Database: campusfix_nosql
 * Collection: complaint_documents
 */

// 1. Connect and initialize database
const db = db.getSiblingDB("campusfix_nosql");

// Drop existing collection if recreating
db.complaint_documents.drop();

// 2. Create Collection with JSON Schema Validation
db.createCollection("complaint_documents", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["complaint_id", "title", "description", "category", "created_at"],
      properties: {
        complaint_id: {
          bsonType: "long",
          description: "Relational complaint_id reference from SQL database"
        },
        title: {
          bsonType: "string",
          description: "Title of the complaint - required non-empty string"
        },
        description: {
          bsonType: "string",
          description: "Detailed description of the issue"
        },
        category: {
          bsonType: "string",
          description: "Campus category: Electrical, Plumbing, Wi-Fi, Hostel, Cleanliness, Classroom"
        },
        department: {
          bsonType: "string",
          description: "Responsible maintenance department"
        },
        extracted_keywords: {
          bsonType: "array",
          items: {
            bsonType: "string"
          },
          description: "Keywords extracted using NLP tokenization / TF-IDF for fast search"
        },
        image_url: {
          bsonType: ["string", "null"],
          description: "S3 or Cloudinary URL of uploaded evidence photo"
        },
        metadata: {
          bsonType: "object",
          properties: {
            block: { bsonType: "string" },
            room_number: { bsonType: "string" },
            urgency_score: { bsonType: "double" },
            device_info: { bsonType: "string" }
          }
        },
        created_at: {
          bsonType: "date",
          description: "Timestamp of complaint creation"
        }
      }
    }
  }
});

// 3. Create Indexes for Search and Performance
// Text Index on title, description, and keywords for multi-field text search
db.complaint_documents.createIndex(
  {
    title: "text",
    description: "text",
    extracted_keywords: "text"
  },
  {
    weights: {
      title: 10,
      extracted_keywords: 5,
      description: 2
    },
    name: "idx_complaint_text_search"
  }
);

// Compound Index for fast category filtering and sorting by creation time
db.complaint_documents.createIndex(
  { category: 1, created_at: -1 },
  { name: "idx_category_created" }
);

// Unique Index on complaint_id
db.complaint_documents.createIndex(
  { complaint_id: 1 },
  { unique: true, name: "idx_complaint_id_unique" }
);

// 4. Sample Document Inserts (DML: Create)
db.complaint_documents.insertMany([
  {
    complaint_id: NumberLong(1),
    title: "Water leaking in the hostel bathroom",
    description: "Continuous water dripping from the ceiling pipe in Block B 3rd floor washroom. Risk of floor slipping.",
    category: "Plumbing",
    department: "Estate & Plumbing",
    extracted_keywords: ["water", "leak", "hostel", "bathroom", "pipe", "ceiling"],
    image_url: "https://campusfix.pes.edu/uploads/complaints/water_leak_b302.jpg",
    metadata: {
      block: "Hostel Block B",
      room_number: "Washroom 3B",
      urgency_score: 0.85,
      device_info: "Android App / Chrome Mobile"
    },
    created_at: new Date("2026-10-20T09:15:00Z")
  },
  {
    complaint_id: NumberLong(2),
    title: "Hostel washroom pipe leakage",
    description: "Water tap broken and severe leakage in Hostel B floor 3 bathroom.",
    category: "Plumbing",
    department: "Estate & Plumbing",
    extracted_keywords: ["water", "leakage", "tap", "hostel", "washroom"],
    image_url: "https://campusfix.pes.edu/uploads/complaints/tap_leak.jpg",
    metadata: {
      block: "Hostel Block B",
      room_number: "Washroom 3B",
      urgency_score: 0.90,
      device_info: "Web Browser"
    },
    created_at: new Date("2026-10-20T10:30:00Z")
  },
  {
    complaint_id: NumberLong(3),
    title: "Classroom projector flickering",
    description: "Projector in Room 402 GJBC displays red tint and turns off after 10 minutes.",
    category: "Classroom / AV",
    department: "IT & Media Infrastructure",
    extracted_keywords: ["projector", "flicker", "classroom", "display", "av"],
    image_url: null,
    metadata: {
      block: "GJBC Block",
      room_number: "402",
      urgency_score: 0.65,
      device_info: "Staff Portal"
    },
    created_at: new Date("2026-10-21T11:00:00Z")
  },
  {
    complaint_id: NumberLong(4),
    title: "Wi-Fi access point down in Central Library",
    description: "No Wi-Fi signal on 2nd floor silent study area of central library. SSID PES-STUDENT not broadcasting.",
    category: "Wi-Fi & Network",
    department: "IT & Networking",
    extracted_keywords: ["wifi", "access point", "library", "ssid", "internet"],
    image_url: null,
    metadata: {
      block: "Central Library",
      room_number: "2nd Floor Silent Zone",
      urgency_score: 0.75,
      device_info: "iOS App"
    },
    created_at: new Date("2026-10-22T14:20:00Z")
  },
  {
    complaint_id: NumberLong(5),
    title: "Air conditioning cooling failure",
    description: "Auditorium AC unit 2 making loud buzzing noise and not cooling.",
    category: "Electrical / HVAC",
    department: "Electrical Maintenance",
    extracted_keywords: ["ac", "cooling", "auditorium", "hvac", "noise"],
    image_url: "https://campusfix.pes.edu/uploads/complaints/ac_unit.jpg",
    metadata: {
      block: "MRD Auditorium",
      room_number: "Main Hall",
      urgency_score: 0.80,
      device_info: "Admin Portal"
    },
    created_at: new Date("2026-10-23T16:00:00Z")
  }
]);

// ============================================================================
// 5. NoSQL OPERATIONS & AGGREGATIONS (Rubric: NoSQL Feature & RUD - 7 Marks)
// ============================================================================

// 5.1 Full-Text Search (Finding duplicate / similar complaints)
print("=== 5.1 Text Search: 'Water leaking hostel bathroom' ===");
db.complaint_documents.find(
  { $text: { $search: "water leaking hostel bathroom" } },
  { score: { $meta: "textScore" }, title: 1, category: 1, extracted_keywords: 1 }
).sort({ score: { $meta: "textScore" } }).forEach(printjson);

// 5.2 Update Operation (DML: Update)
db.complaint_documents.updateOne(
  { complaint_id: NumberLong(1) },
  { 
    $set: { "metadata.verified_by_warden": true },
    $push: { extracted_keywords: "urgent_repair" }
  }
);

// 5.3 Aggregation 1: Group Complaints by Category with Keyword Summary
print("=== 5.3 Aggregation: Category breakdown and counts ===");
db.complaint_documents.aggregate([
  {
    $group: {
      _id: "$category",
      total_reports: { $sum: 1 },
      avg_urgency: { $avg: "$metadata.urgency_score" },
      sample_titles: { $push: "$title" }
    }
  },
  { $sort: { total_reports: -1 } }
]).forEach(printjson);

// 5.4 Aggregation 2: Keyword Frequency Analysis across All Documents
print("=== 5.4 Aggregation: Top extracted keywords ===");
db.complaint_documents.aggregate([
  { $unwind: "$extracted_keywords" },
  {
    $group: {
      _id: "$extracted_keywords",
      frequency: { $sum: 1 }
    }
  },
  { $sort: { frequency: -1 } },
  { $limit: 10 }
]).forEach(printjson);
