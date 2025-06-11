import type { Config } from 'drizzle-kit';

export default {
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: 'file:./src/data/data.db',
  },
} satisfies Config;
