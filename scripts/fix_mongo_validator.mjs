import { MongoClient } from 'mongodb';

async function fixValidator() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campusfix_nosql');
  await client.connect();
  const db = client.db('campusfix_nosql');
  try {
    await db.command({
      collMod: 'complaint_documents',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['complaint_id', 'title', 'description', 'category'],
          properties: {
            complaint_id: {
              bsonType: ['int', 'long', 'double', 'number'],
              description: 'Relational complaint_id reference from SQL database',
            },
            title: {
              bsonType: 'string',
              description: 'Title of the complaint - required non-empty string',
            },
            description: {
              bsonType: 'string',
              description: 'Detailed description of the issue',
            },
            category: {
              bsonType: 'string',
              description: 'Campus category',
            },
            department: {
              bsonType: 'string',
              description: 'Responsible maintenance department',
            },
            extracted_keywords: {
              bsonType: 'array',
              items: { bsonType: 'string' },
            },
            image_url: {
              bsonType: ['string', 'null'],
            },
            metadata: {
              bsonType: 'object',
            },
            created_at: {
              bsonType: ['date', 'string'],
            },
          },
        },
      },
      validationLevel: 'moderate',
    });
    console.log('Successfully updated MongoDB collMod validator to accept int, long, double, and flexible metadata!');
  } catch (err) {
    console.error('Error updating collMod:', err);
  } finally {
    await client.close();
  }
}

fixValidator();
