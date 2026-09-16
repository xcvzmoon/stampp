import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schemas/index.ts',
  out: './migrations',
  dbCredentials: {
    // Resolved at generate/migrate time via process.env after Varlock load.
    url: process.env.DATABASE_URL ?? 'postgres://localhost:5432/stampp',
  },
});
