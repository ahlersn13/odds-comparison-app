import { NextResponse } from 'next/server';
import sql from '../../lib/db';

// Only active sports - update as seasons change
const ACTIVE_SPORTS = [
  'basketball_nba',
  'basketball_ncaab',
  'basketball_wncaab',
  'icehockey_nhl',
];

export async function GET(request: Request) {
  // Verify this is being called by our cron service
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
          await sql`
            INSERT INTO odds_cache (sport_key, game_id, data, fetched_at)
            VALUES (${sport}, ${game.id}, ${JSON.stringify(game)}, NOW())
            ON CONFLICT (sport_key, game_id)
            DO UPDATE SET data = ${JSON.stringify(game)}, fetched_at = NOW()
          `;
        }

        await sql`
          INSERT INTO last_fetch (sport_key, fetched_at)
          VALUES (${sport}, NOW())
          ON CONFLICT (sport_key)
          DO UPDATE SET fetched_at = NOW()
        `;

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