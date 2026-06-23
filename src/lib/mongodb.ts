import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI não definida");

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = new MongoClient(uri).connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  clientPromise = new MongoClient(uri).connect();
}

let dbInstance: Db | null = null;

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);

  // Garante índice único no email — idempotente, roda apenas uma vez por conexão
  if (!dbInstance) {
    dbInstance = db;
    await db
      .collection("users")
      .createIndex({ email: 1 }, { unique: true, background: true })
      .catch(() => {}); // ignora se já existir
  }

  return db;
}