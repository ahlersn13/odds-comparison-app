import { NextResponse } from 'next/server';
import { query } from '../../lib/db';

const CACHE_DURATION_HOURS = 2;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sport = searchParams.get('sport') || 'basketball_nba';

  try {
    const lastFetch = await query(
      'SELECT fetched_at FROM last_fetch WHERE sport_key = $1',
      [sport]
    );

    const now = new Date();
    const cacheExpiry = new Date(now.getTime() - CACHE_DURATION_HOURS * 60 * 60 * 1000);
    
    const needsFresh = lastFetch.length === 0 || 
      new Date(lastFetch[0].fetched_at) < cacheExpiry;

    if (!needsFresh) {
      console.log(`Returning cached data for ${sport}`);
      const cachedGames = await query(
        'SELECT data FROM odds_cache WHERE sport_key = $1 ORDER BY fetched_at DESC',
        [sport]
      );
      
      const games = cachedGames
        .map(row => typeof row.data === 'string' ? JSON.parse(row.data) : row.data)
        .filter(game => new Date(game.commence_time) > new Date());
      
      return NextResponse.json(games);
    }

    console.log(`Fetching fresh data for ${sport}`);
    const apiKey = process.env.ODDS_API_KEY;
    const regions = 'us';
    const markets = 'h2h,spreads,totals';
    
    const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${apiKey}&regions=${regions}&markets=${markets}`;
    
    const response = await fetch(url);
    const games = await response.json();

    if (Array.isArray(games) && games.length > 0) {
      for (const game of games) {
        await query(
          `INSERT INTO odds_cache (sport_key, game_id, data, fetched_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (sport_key, game_id)
           DO UPDATE SET data = $3, fetched_at = NOW()`,
          [sport, game.id, JSON.stringify(game)]
        );
      }

      await query(
        `INSERT INTO last_fetch (sport_key, fetched_at)
         VALUES ($1, NOW())
         ON CONFLICT (sport_key)
         DO UPDATE SET fetched_at = NOW()`,
        [sport]
      );
    }

    // Filter out completed games before returning
    const upcomingGames = Array.isArray(games) 
      ? games.filter(game => new Date(game.commence_time) > new Date())
      : games;

    return NextResponse.json(upcomingGames);

  } catch (error) {
    console.error('Error fetching odds:', error);
    return NextResponse.json({ error: 'Failed to fetch odds' }, { status: 500 });
  }
}