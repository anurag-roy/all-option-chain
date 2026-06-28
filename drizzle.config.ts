import { defineConfig } from 'drizzle-kit';
import { env } from './server/lib/env';

export default defineConfig({
  dialect: 'sqlite',
  casing: 'snake_case',
  schema: './server/db/schema.ts',
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
});
