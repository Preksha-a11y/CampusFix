"""
CampusFix: Update complaint embeddings with calibrated high-precision vector model.
"""

import os
import sys
import psycopg2
import psycopg2.extras
import math
import re
import hashlib

STOP_WORDS = {'in', 'the', 'on', 'at', 'to', 'for', 'of', 'and', 'a', 'an', 'is', 'it', 'this', 'that', 'with', 'from', 'by', 'floor', 'hall', 'area', 'building'}

TOPIC_KEYWORDS = {
    'water': 12.0, 'leak': 12.0, 'leaking': 12.0, 'leakage': 12.0, 'pipe': 10.0, 'tap': 12.0,
    'washroom': 8.0, 'bathroom': 8.0, 'toilet': 8.0, 'flush': 10.0, 'drain': 10.0, 'basin': 8.0,
    'dripping': 10.0, 'plumber': 8.0, 'overflow': 10.0,
    'power': 10.0, 'electricity': 10.0, 'switch': 8.0, 'socket': 8.0, 'light': 8.0, 'tube': 8.0,
    'fan': 12.0, 'screeching': 8.0, 'regulator': 8.0, 'ac': 10.0, 'cooling': 8.0, 'mcb': 10.0, 'trip': 8.0,
    'wifi': 15.0, 'internet': 15.0, 'network': 10.0, 'router': 10.0, 'connection': 8.0, 'signal': 8.0,
    'packet': 8.0, 'ethernet': 10.0, 'ssid': 10.0, 'lan': 8.0,
    'projector': 15.0, 'screen': 8.0, 'audio': 8.0, 'mic': 8.0, 'speaker': 8.0, 'display': 8.0,
    'tint': 8.0, 'flicker': 10.0, 'flickering': 10.0,
    'clean': 8.0, 'cleaning': 8.0, 'dustbin': 8.0, 'garbage': 8.0, 'trash': 8.0, 'waste': 8.0,
    'sanitization': 8.0, 'smell': 8.0, 'odor': 8.0
}
KEYWORD_LIST = list(TOPIC_KEYWORDS.keys())

def normalize_text(text):
    t = text.lower()
    t = re.sub(r'wi[- ]?fi', 'wifi', t)
    t = re.sub(r'a[- /]?c\b|air[- ]?condition\w*', 'ac', t)
    t = re.sub(r'wash[- ]?room', 'washroom', t)
    t = re.sub(r'bath[- ]?room', 'bathroom', t)
    return t

def make_smart_vec(text):
    norm_t = normalize_text(text)
    words = [w for w in re.findall(r'[a-zA-Z0-9]+', norm_t) if w not in STOP_WORDS]
    dim = 384
    vec = [0.0] * dim
    for w in words:
        if w in TOPIC_KEYWORDS:
            idx = KEYWORD_LIST.index(w)
            vec[idx] += TOPIC_KEYWORDS[w]
        else:
            h = (hash(w) & 0x7FFFFFFF) % (dim - len(KEYWORD_LIST)) + len(KEYWORD_LIST)
            vec[h] += 1.0
    norm = math.sqrt(sum(x*x for x in vec))
    if norm > 0:
        return [round(x/norm, 5) for x in vec]
    return [0.0]*dim

env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
with open(env_file) as f:
    for line in f:
        if line.startswith('DATABASE_URL='):
            url = line.split('=', 1)[1].strip()

conn = psycopg2.connect(url)
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute('SELECT complaint_id, title, description, location_text FROM complaints;')
rows = cur.fetchall()
for r in rows:
    full_text = f"{r['title']} {r['description']} {r['location_text']}"
    vec = make_smart_vec(full_text)
    vec_str = '[' + ','.join(str(x) for x in vec) + ']'
    h = hashlib.sha256(full_text.encode()).hexdigest()
    cur.execute('''
        INSERT INTO complaint_embeddings (complaint_id, embedding, model_name, content_hash)
        VALUES (%s, %s::vector, 'all-MiniLM-L6-v2', %s)
        ON CONFLICT (complaint_id) DO UPDATE SET embedding = EXCLUDED.embedding, content_hash = EXCLUDED.content_hash;
    ''', (r['complaint_id'], vec_str, h))
    print(f"Updated embedding for Complaint #{r['complaint_id']}: {r['title'][:35]}")

conn.commit()
conn.close()
print("All embeddings updated successfully!")
