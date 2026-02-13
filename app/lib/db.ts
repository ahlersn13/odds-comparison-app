import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export default sql;

// Create tables if they don't exist
export async function initializeDatabase() {
  await sql`
    CREATE TABLE IF NOT EXISTS odds_cache (
      id SERIAL PRIMARY KEY,
      sport_key VARCHAR(100) NOT NULL,
      game_id VARCHAR(100) NOT NULL,
      data JSONB NOT NULL,
      fetched_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(sport_key, game_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS last_fetch (
      id SERIAL PRIMARY KEY,
      sport_key VARCHAR(100) UNIQUE NOT NULL,
      fetched_at TIMESTAMP DEFAULT NOW()
    )
  `;
}