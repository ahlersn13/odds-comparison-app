import { NextResponse } from 'next/server';
import { query } from '../../lib/db';

const ACTIVE_SPORTS = [
  'basketball_nba',
  'basketball_ncaab',
  'basketball_wncaab',
  'icehockey_nhl',
];

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.ODDS_API_KEY;
  const regions = 'us';
  const markets = 'h2h,spreads,totals';
  const results = [];

  for (const sport of ACTIVE_SPORTS) {
    try {
      console.log(`Cron: Fetching ${sport}`);
      
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

        results.push({ sport, status: 'success', games: games.length });
      } else {
        results.push({ sport, status: 'no games', games: 0 });
      }
    } catch (error) {
      console.error(`Cron error for ${sport}:`, error);
      results.push({ sport, status: 'error' });
    }
  }

  return NextResponse.json({ 
    message: 'Cron job completed',
    timestamp: new Date().toISOString(),
    results 
  });
}