import { MONGO_DB, MONGO_URI } from "$env/static/private";
import { Collection, MongoClient, type Document } from "mongodb";

const client = new MongoClient(MONGO_URI as string);
await client.connect();

const db = client.db(MONGO_DB);

export default new Proxy(
    {},
    {
        get: (_, property: string, __) => db.collection(property),
    }
) as Record<string, Collection<Document>>;
