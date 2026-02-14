'use client';

import { useEffect, useState } from 'react';

interface Outcome {
  name: string;
  price: number;
  point?: number;
}

interface Market {
  key: string;
  outcomes: Outcome[];
}

interface Bookmaker {
  key: string;
  title: string;
  markets: Market[];
}

interface Game {
  id: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: Bookmaker[];
}

interface OddsComparisonProps {
  sport: string;
  sportTitle: string;
}

export default function OddsComparison({ sport, sportTitle }: OddsComparisonProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState('fanduel');

  const sportsbooks = [
    { key: 'fanduel', title: 'FanDuel' },
    { key: 'draftkings', title: 'DraftKings' },
    { key: 'betmgm', title: 'BetMGM' },
    { key: 'williamhill_us', title: 'Caesars' },
    { key: 'betrivers', title: 'BetRivers' },
    { key: 'fanatics', title: 'Fanatics' },
    { key: 'mybookieag', title: 'MyBookie.ag' },
    { key: 'lowvig', title: 'LowVig.ag' },
    { key: 'betonlineag', title: 'BetOnline.ag' },
    { key: 'betus', title: 'BetUS' },
    { key: 'bovada', title: 'Bovada' },
  ];

  useEffect(() => {
      fetch(`/api/odds?sport=${sport}`)
        .then(res => res.json())
        .then(data => {
          setGames(Array.isArray(data) ? data : []);
          setLoading(false);
        })
        .catch(err => {
          console.error('Error fetching odds:', err);
          setGames([]);
          setLoading(false);
        });
    }, [sport]);

  // Convert decimal odds to American odds
  const decimalToAmerican = (decimal: number): number => {
    if (decimal >= 2.0) {
      return Math.round((decimal - 1) * 100);
    } else {
      return Math.round(-100 / (decimal - 1));
    }
  };

  // Calculate "juice-adjusted" spread value
  const calculateJuiceAdjustedValue = (spread: number, price: number): number => {
    const americanOdds = decimalToAmerican(price);
    
    // Standard juice is -110
    const standardJuice = -110;
    const juiceDiff = americanOdds - standardJuice;
    
    // More conservative adjustment: every 20 points of juice ≈ 0.1 points of spread value
    const pointAdjustment = (juiceDiff / 20) * 0.1;
    
    return spread + pointAdjustment;
  };

  // Get spread data from selected book
  const getBookSpreadData = (game: Game, teamName: string) => {
    const book = game.bookmakers.find(b => b.key === selectedBook);
    if (!book) return null;
    
    const market = book.markets.find(m => m.key === 'spreads');
    if (!market) return null;
    
    const outcome = market.outcomes.find(o => o.name === teamName);
    if (!outcome || outcome.point === undefined) return null;
    
    return {
      spread: outcome.point,
      price: outcome.price,
      americanOdds: decimalToAmerican(outcome.price),
      adjustedSpread: calculateJuiceAdjustedValue(outcome.point, outcome.price)
    };
  };

  // Get market average (juice-adjusted)
  const getMarketAverageAdjustedSpread = (game: Game, teamName: string) => {
    const adjustedSpreads: number[] = [];
    
    game.bookmakers.forEach(book => {
      if (book.key === selectedBook) return;
      
      const market = book.markets.find(m => m.key === 'spreads');
      if (market) {
        const outcome = market.outcomes.find(o => o.name === teamName);
        if (outcome && outcome.point !== undefined) {
          const adjusted = calculateJuiceAdjustedValue(outcome.point, outcome.price);
          adjustedSpreads.push(adjusted);
        }
      }
    });

    if (adjustedSpreads.length === 0) return null;
    return adjustedSpreads.reduce((a, b) => a + b, 0) / adjustedSpreads.length;
  };

  // Calculate all value opportunities
  const getTopValuePlays = () => {
    const valuePlays: Array<{
      game: Game;
      team: string;
      spread: number;
      price: number;
      marketAvg: number;
      valueDiff: number;
    }> = [];

    games.forEach(game => {
      // Check home team
      const homeData = getBookSpreadData(game, game.home_team);
      const homeMarketAvg = getMarketAverageAdjustedSpread(game, game.home_team);
      if (homeData && homeMarketAvg !== null) {
        const homeValueDiff = homeData.adjustedSpread - homeMarketAvg;
        valuePlays.push({
          game,
          team: game.home_team,
          spread: homeData.spread,
          price: homeData.price,
          marketAvg: homeMarketAvg,
          valueDiff: homeValueDiff
        });
      }

      // Check away team
      const awayData = getBookSpreadData(game, game.away_team);
      const awayMarketAvg = getMarketAverageAdjustedSpread(game, game.away_team);
      if (awayData && awayMarketAvg !== null) {
        const awayValueDiff = awayData.adjustedSpread - awayMarketAvg;
        valuePlays.push({
          game,
          team: game.away_team,
          spread: awayData.spread,
          price: awayData.price,
          marketAvg: awayMarketAvg,
          valueDiff: awayValueDiff
        });
      }
    });

    return valuePlays.sort((a, b) => b.valueDiff - a.valueDiff).slice(0, 10);
  };

  const topValuePlays = getTopValuePlays();

  if (loading) return <div className="p-8">Loading odds...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-4xl font-bold mb-2">{sportTitle} Spread Comparison</h1>
      <p className="text-gray-600 mb-6">Juice-adjusted spread analysis - find true value</p>

      {/* Sportsbook Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Your Sportsbook:</label>
        <select 
          value={selectedBook}
          onChange={(e) => setSelectedBook(e.target.value)}
          className="border rounded px-4 py-2 w-64"
        >
          {sportsbooks.map(book => (
            <option key={book.key} value={book.key}>{book.title}</option>
          ))}
        </select>
      </div>

      {/* TOP 10 VALUE PLAYS */}
      {topValuePlays.length > 0 && (
        <div className="mb-8 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6 border-2 border-green-200">
          <h2 className="text-2xl font-bold mb-4 text-green-800">
            🔥 Top 10 Value Opportunities
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Best line values on {sportsbooks.find(b => b.key === selectedBook)?.title} vs market
          </p>
          
          <div className="space-y-2">
            {topValuePlays.map((play, index) => {
              const opponent = play.team === play.game.home_team 
                ? play.game.away_team 
                : play.game.home_team;
              const americanOdds = decimalToAmerican(play.price);
              
              return (
                <div 
                  key={`${play.game.id}-${play.team}`}
                  className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <span className="font-bold text-lg mr-2">#{index + 1}</span>
                      <span className="font-semibold">{play.team}</span>
                      <span className="text-gray-500 text-sm ml-2">vs {opponent}</span>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm text-gray-600">Your Line</div>
                        <div className="font-bold">
                          {play.spread > 0 ? '+' : ''}{play.spread}
                          <span className="text-sm text-gray-500 ml-1">
                            ({americanOdds > 0 ? '+' : ''}{americanOdds})
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm text-gray-600">Market Avg</div>
                        <div className="font-medium">
                          {play.marketAvg > 0 ? '+' : ''}{play.marketAvg.toFixed(1)}
                        </div>
                      </div>
                      
                      <div className="bg-green-100 text-green-800 font-bold px-3 py-2 rounded">
                        +{play.valueDiff.toFixed(2)} pts
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


{/* All Games List */}
<h2 className="text-2xl font-bold mb-4">All Games</h2>

{/* CHECK IF SELECTED BOOK HAS ANY GAMES */}
{games.length > 0 && !games.some(game => game.bookmakers.find(b => b.key === selectedBook)) ? (
  <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6 text-center">
    <p className="text-xl font-semibold text-yellow-800 mb-2">
      ⚠️ {sportsbooks.find(b => b.key === selectedBook)?.title} has no odds for these games
    </p>
    <p className="text-gray-600 mb-4">
      Try selecting a different sportsbook that covers these games:
    </p>
    <div className="flex flex-wrap gap-2 justify-center">
      {Array.from(new Set(games.flatMap(g => g.bookmakers.map(b => b.key))))
        .map(bookKey => {
          const book = sportsbooks.find(sb => sb.key === bookKey);
          return book ? (
            <button
              key={bookKey}
              onClick={() => setSelectedBook(bookKey)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded font-medium transition"
            >
              Switch to {book.title}
            </button>
          ) : null;
        })}
    </div>
  </div>
) : games.length === 0 ? (
  <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-6 text-center">
    <p className="text-xl font-semibold text-gray-600">
      No games currently available for {sportTitle}
    </p>
    <p className="text-sm text-gray-500 mt-2">
      Check back during the season for live odds
    </p>
  </div>
) : (
  <div className="space-y-6">
    {games.map((game) => {
      const homeData = getBookSpreadData(game, game.home_team);
      const awayData = getBookSpreadData(game, game.away_team);
      const homeMarketAvg = getMarketAverageAdjustedSpread(game, game.home_team);
      const awayMarketAvg = getMarketAverageAdjustedSpread(game, game.away_team);
      
      const homeValueDiff = homeData && homeMarketAvg !== null 
        ? homeData.adjustedSpread - homeMarketAvg 
        : null;
      const awayValueDiff = awayData && awayMarketAvg !== null 
        ? awayData.adjustedSpread - awayMarketAvg 
        : null;

      return (
        <div key={game.id} className="border rounded-lg p-6 bg-white shadow">
          <div className="mb-4">
            <h2 className="text-2xl font-bold">
              {game.away_team} @ {game.home_team}
            </h2>
            <p className="text-sm text-gray-500">
              {new Date(game.commence_time).toLocaleString()}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Away Team */}
            <div className="border rounded p-4">
              <h3 className="font-semibold mb-3">{game.away_team}</h3>
              {awayData ? (
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="text-gray-600">Spread:</span>{' '}
                    <span className="font-bold text-lg">
                      {awayData.spread > 0 ? '+' : ''}{awayData.spread}
                    </span>
                    <span className="text-sm text-gray-500 ml-2">
                      ({awayData.americanOdds > 0 ? '+' : ''}{awayData.americanOdds})
                    </span>
                  </p>
                  <p className="text-sm">
                    <span className="text-gray-600">Juice-Adjusted:</span>{' '}
                    <span className="font-medium">
                      {awayData.adjustedSpread > 0 ? '+' : ''}{awayData.adjustedSpread.toFixed(2)}
                    </span>
                  </p>
                  <p className="text-sm">
                    <span className="text-gray-600">Market Avg (adj):</span>{' '}
                    <span>
                      {awayMarketAvg !== null 
                        ? (awayMarketAvg > 0 ? '+' : '') + awayMarketAvg.toFixed(2)
                        : 'N/A'
                      }
                    </span>
                  </p>
                  {awayValueDiff !== null && (
                    <div className={`text-sm font-bold p-2 rounded mt-2 ${
                      awayValueDiff > 0.15 ? 'bg-green-100 text-green-700' : 
                      awayValueDiff < -0.15 ? 'bg-red-100 text-red-700' : 
                      'bg-gray-100 text-gray-700'
                    }`}>
                      Value: {awayValueDiff > 0 ? '+' : ''}{awayValueDiff.toFixed(2)} pts
                      {awayValueDiff > 0.15 && ' ✓ GOOD VALUE'}
                      {awayValueDiff < -0.15 && ' ✗ Poor value'}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No data available</p>
              )}
            </div>

            {/* Home Team */}
            <div className="border rounded p-4">
              <h3 className="font-semibold mb-3">{game.home_team}</h3>
              {homeData ? (
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="text-gray-600">Spread:</span>{' '}
                    <span className="font-bold text-lg">
                      {homeData.spread > 0 ? '+' : ''}{homeData.spread}
                    </span>
                    <span className="text-sm text-gray-500 ml-2">
                      ({homeData.americanOdds > 0 ? '+' : ''}{homeData.americanOdds})
                    </span>
                  </p>
                  <p className="text-sm">
                    <span className="text-gray-600">Juice-Adjusted:</span>{' '}
                    <span className="font-medium">
                      {homeData.adjustedSpread > 0 ? '+' : ''}{homeData.adjustedSpread.toFixed(2)}
                    </span>
                  </p>
                  <p className="text-sm">
                    <span className="text-gray-600">Market Avg (adj):</span>{' '}
                    <span>
                      {homeMarketAvg !== null 
                        ? (homeMarketAvg > 0 ? '+' : '') + homeMarketAvg.toFixed(2)
                        : 'N/A'
                      }
                    </span>
                  </p>
                  {homeValueDiff !== null && (
                    <div className={`text-sm font-bold p-2 rounded mt-2 ${
                      homeValueDiff > 0.15 ? 'bg-green-100 text-green-700' : 
                      homeValueDiff < -0.15 ? 'bg-red-100 text-red-700' : 
                      'bg-gray-100 text-gray-700'
                    }`}>
                      Value: {homeValueDiff > 0 ? '+' : ''}{homeValueDiff.toFixed(2)} pts
                      {homeValueDiff > 0.15 && ' ✓ GOOD VALUE'}
                      {homeValueDiff < -0.15 && ' ✗ Poor value'}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No data available</p>
              )}
            </div>
          </div>
        </div>
      );
    })}
      </div>
    )}
    </div>
  );
}