import { drizzle } from 'drizzle-orm/better-sqlite3';

export const db = drizzle('src/data/data.db');
export const closeDb = async () => db.$client.close();
