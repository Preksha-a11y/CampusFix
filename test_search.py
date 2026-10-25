import update_embeddings

conn = update_embeddings.psycopg2.connect(update_embeddings.url)
cur = conn.cursor(cursor_factory=update_embeddings.psycopg2.extras.RealDictCursor)

def run_query(q):
    v = update_embeddings.make_smart_vec(q)
    v_str = '[' + ','.join(str(x) for x in v) + ']'
    cur.execute('''
        SELECT c.complaint_id, c.title, ROUND((1 - (ce.embedding <=> %s::vector))::numeric, 4) as score
        FROM complaint_embeddings ce
        JOIN complaints c ON ce.complaint_id = c.complaint_id
        ORDER BY ce.embedding <=> %s::vector;
    ''', (v_str, v_str))
    print(f"\nSearch Query: '{q}'")
    for r in cur.fetchall():
        print(f"  #{r['complaint_id']}: {r['title'][:40]} -> {float(r['score'])*100:.1f}%")

run_query("wifi not working in hostel")
run_query("Water tap leaking in washroom")
run_query("Classroom projector screen flickering")
run_query("Ceiling fan making loud noise")
conn.close()
