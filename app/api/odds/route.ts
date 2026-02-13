import { NextResponse } from 'next/server';
import sql from '../../lib/db';

const CACHE_DURATION_HOURS = 2;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sport = searchParams.get('sport') || 'basketball_nba';

  try {
    // Check when we last fetched this sport
    const lastFetch = await sql`
      SELECT fetched_at FROM last_fetch 
      WHERE sport_key = ${sport}
    `;

    const now = new Date();
    const cacheExpiry = new Date(now.getTime() - CACHE_DURATION_HOURS * 60 * 60 * 1000);
    
    const needsFresh = lastFetch.length === 0 || 
      new Date(lastFetch[0].fetched_at) < cacheExpiry;

    if (!needsFresh) {
      // Return cached data from database
      console.log(`Returning cached data for ${sport}`);
      const cachedGames = await sql`
        SELECT data FROM odds_cache 
        WHERE sport_key = ${sport}
        ORDER BY fetched_at DESC
      `;
      
      const games = cachedGames.map(row => row.data);
      return NextResponse.json(games);
    }

    // Fetch fresh data from The Odds API
    console.log(`Fetching fresh data for ${sport}`);
    const apiKey = process.env.ODDS_API_KEY;
    const regions = 'us';
    const markets = 'h2h,spreads,totals';
    
    const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${apiKey}&regions=${regions}&markets=${markets}`;
    
    const response = await fetch(url);
    const games = await response.json();

    if (Array.isArray(games) && games.length > 0) {
      // Save each game to database
      for (const game of games) {
        await sql`
          INSERT INTO odds_cache (sport_key, game_id, data, fetched_at)
          VALUES (${sport}, ${game.id}, ${JSON.stringify(game)}, NOW())
          ON CONFLICT (sport_key, game_id) 
          DO UPDATE SET data = ${JSON.stringify(game)}, fetched_at = NOW()
        `;
      }

      // Update last fetch time
      await sql`
        INSERT INTO last_fetch (sport_key, fetched_at)
        VALUES (${sport}, NOW())
        ON CONFLICT (sport_key)
        DO UPDATE SET fetched_at = NOW()
      `;
    }

    return NextResponse.json(games);

  } catch (error) {
    console.error('Error fetching odds:', error);
    return NextResponse.json({ error: 'Failed to fetch odds' }, { status: 500 });
  }
}