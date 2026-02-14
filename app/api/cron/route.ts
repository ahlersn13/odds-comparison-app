import { NextResponse } from 'next/server';
import { query } from '../../lib/db';

// All sports with their active status
const SPORTS_CONFIG = {
  high_priority: [
    'basketball_nba',
    'basketball_ncaab',
    'basketball_wncaab',
    'icehockey_nhl',
  ],
  medium_priority: [
    'basketball_nba',
    'basketball_ncaab',
    'basketball_wncaab',
    'icehockey_nhl',
  ],
  low_priority: [
    'basketball_nba',
    'basketball_ncaab',
    'basketball_wncaab',
    'icehockey_nhl',
  ],
};

async function fetchAndStoreSport(sport: string, apiKey: string) {
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

    return { sport, status: 'success', games: games.length };
  }

  return { sport, status: 'no games', games: 0 };
}

async function hasUpcomingGames(sport: string, withinHours: number): Promise<boolean> {
  const result = await query(
    `SELECT data FROM odds_cache 
     WHERE sport_key = $1 
     AND (data->>'commence_time')::timestamp > NOW()
     AND (data->>'commence_time')::timestamp < NOW() + INTERVAL '${withinHours} hours'
     LIMIT 1`,
    [sport]
  );
  return result.length > 0;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const priority = searchParams.get('priority') || 'medium';

  const apiKey = process.env.ODDS_API_KEY!;
  const results = [];

  try {
    if (priority === 'high') {
      // Every 15 min - only fetch sports with games starting within 3 hours
      console.log('High priority cron - checking for imminent games');
      for (const sport of SPORTS_CONFIG.high_priority) {
        const hasGames = await hasUpcomingGames(sport, 3);
        if (hasGames) {
          console.log(`High priority: fetching ${sport}`);
          const result = await fetchAndStoreSport(sport, apiKey);
          results.push({ ...result, priority: 'high' });
        } else {
          results.push({ sport, status: 'skipped - no imminent games', priority: 'high' });
        }
      }
    } else if (priority === 'medium') {
      // Every hour - fetch sports with games today
      console.log('Medium priority cron - checking for games today');
      for (const sport of SPORTS_CONFIG.medium_priority) {
        const hasGames = await hasUpcomingGames(sport, 24);
        if (hasGames) {
          console.log(`Medium priority: fetching ${sport}`);
          const result = await fetchAndStoreSport(sport, apiKey);
          results.push({ ...result, priority: 'medium' });
        } else {
          results.push({ sport, status: 'skipped - no games today', priority: 'medium' });
        }
      }
    } else if (priority === 'low') {
      // Every 2 hours - fetch all active sports regardless
      console.log('Low priority cron - fetching all active sports');
      for (const sport of SPORTS_CONFIG.low_priority) {
        console.log(`Low priority: fetching ${sport}`);
        const result = await fetchAndStoreSport(sport, apiKey);
        results.push({ ...result, priority: 'low' });
      }
    }

    return NextResponse.json({
      message: 'Cron job completed',
      priority,
      timestamp: new Date().toISOString(),
      results
    });

  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}