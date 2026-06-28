import { createClient } from '@libsql/client';
import { env } from '@server/lib/env';
import { drizzle } from 'drizzle-orm/libsql';

// Create client with busy_timeout to handle concurrent access from multiple workers
const client = createClient({
  url: env.DATABASE_URL,
  // Wait up to 5 seconds for locks to be released
  syncInterval: 5000,
});

// Configure SQLite for better concurrency
client.execute('PRAGMA busy_timeout = 5000').catch(() => {
  // Ignore if pragma fails (e.g., remote database)
});
client.execute('PRAGMA journal_mode = WAL').catch(() => {
  // Ignore if pragma fails (e.g., remote database)
});

export const db = drizzle(client, { casing: 'snake_case' });
export const closeDb = () => client.close();
