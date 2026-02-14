import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export default pool;

export async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function initializeDatabase() {
  await query(`
    CREATE TABLE IF NOT EXISTS odds_cache (
      id SERIAL PRIMARY KEY,
      sport_key VARCHAR(100) NOT NULL,
      game_id VARCHAR(100) NOT NULL,
      data JSONB NOT NULL,
      fetched_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(sport_key, game_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS last_fetch (
      id SERIAL PRIMARY KEY,
      sport_key VARCHAR(100) UNIQUE NOT NULL,
      fetched_at TIMESTAMP DEFAULT NOW()
    )
  `);
}