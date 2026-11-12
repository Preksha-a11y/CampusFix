"""
CampusFix: Polyglot Sync - Synchronize PostgreSQL complaints into MongoDB complaint_documents
"""

import os
import re
import datetime
import psycopg2
import psycopg2.extras
from pymongo import MongoClient

env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
pg_url = None
mongo_uri = "mongodb://127.0.0.1:27017/campusfix_nosql"

with open(env_file) as f:
    for line in f:
        line = line.strip()
        if line.startswith("DATABASE_URL="):
            pg_url = line.split("=", 1)[1].strip()
        elif line.startswith("MONGODB_URI="):
            mongo_uri = line.split("=", 1)[1].strip()

# Connect to MongoDB
mongo_client = MongoClient(mongo_uri, serverSelectionTimeoutMS=4000)
mongo_db = mongo_client.get_database()
col = mongo_db["complaint_documents"]

# Connect to PostgreSQL
pg_conn = psycopg2.connect(pg_url)
pg_cur = pg_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

pg_cur.execute("""
    SELECT 
        c.complaint_id, c.title, c.description, c.location_text, c.priority, c.status, c.created_at,
        cat.category_name, dept.department_name
    FROM complaints c
    JOIN categories cat ON c.category_id = cat.category_id
    JOIN departments dept ON cat.department_id = dept.department_id
    ORDER BY c.complaint_id ASC;
""")
rows = pg_cur.fetchall()

print(f"Syncing {len(rows)} complaints from PostgreSQL to MongoDB 'complaint_documents'...")

def extract_keywords(text):
    words = re.findall(r'[a-zA-Z0-9]{3,}', text.lower())
    stop = {'the', 'and', 'for', 'with', 'room', 'floor', 'hall', 'area', 'near'}
    return list(dict.fromkeys([w for w in words if w not in stop]))[:8]

synced_count = 0
for r in rows:
    cid = int(r['complaint_id'])
    doc = {
        "complaint_id": cid,
        "title": r['title'],
        "description": r['description'],
        "category": r['category_name'],
        "department": r['department_name'],
        "extracted_keywords": extract_keywords(f"{r['title']} {r['description']}"),
        "image_url": f"https://campusfix.pes.edu/uploads/complaints/evidence_c{cid}.jpg" if cid in [1, 2, 7] else None,
        "metadata": {
            "location": r['location_text'],
            "priority": r['priority'],
            "status": r['status']
        },
        "created_at": r['created_at'] if isinstance(r['created_at'], datetime.datetime) else datetime.datetime.now()
    }
    col.update_one({"complaint_id": cid}, {"$set": doc}, upsert=True)
    synced_count += 1
    print(f"  [MongoDB Synced] #{cid}: {r['title'][:40]}")

print(f"\nSuccessfully synced {synced_count} documents into MongoDB '{col.name}' collection!")
total_mongo = col.count_documents({})
print(f"Total documents now in MongoDB complaint_documents: {total_mongo}")

pg_conn.close()
mongo_client.close()
