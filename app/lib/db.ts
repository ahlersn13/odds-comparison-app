import { Pool } from 'pg';

let pool: Pool | null = null;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    console.log('DATABASE_URL exists:', !!connectionString);
    console.log('Connection string start:', connectionString?.substring(0, 20));
    
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      }
    });
  }
  return pool;
}

export default getPool;

export async function query(text: string, params?: any[]) {
  const client = await getPool().connect();
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