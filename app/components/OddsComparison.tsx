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
  const [searchTerm, setSearchTerm] = useState('');
  const [showTodayOnly, setShowTodayOnly] = useState(true);

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

// Get totals data for a team from selected sportsbook
// Get totals data for a team from selected sportsbook
const getBookTotalsData = (game: Game, teamType: 'home' | 'away'): {
  total: number;
  overPrice: number;
  underPrice: number;
  overAmericanOdds: number;
  underAmericanOdds: number;
  overAdjusted: number;
  underAdjusted: number;
} | null => {
  const bookmaker = game.bookmakers.find(b => b.key === selectedBook);
  if (!bookmaker) return null;

  const totalsMarket = bookmaker.markets.find(m => m.key === 'totals');
  if (!totalsMarket) return null;

  const overOutcome = totalsMarket.outcomes.find(o => o.name === 'Over');
  const underOutcome = totalsMarket.outcomes.find(o => o.name === 'Under');
  
  if (!overOutcome || !underOutcome || overOutcome.point === undefined || underOutcome.point === undefined) return null;

  const overAmericanOdds = decimalToAmerican(overOutcome.price);
  const underAmericanOdds = decimalToAmerican(underOutcome.price);
  
  const overAdjusted = calculateJuiceAdjustedValue(overOutcome.point, overOutcome.price);
  const underAdjusted = calculateJuiceAdjustedValue(underOutcome.point, underOutcome.price);

  return {
    total: overOutcome.point,
    overPrice: overOutcome.price,
    underPrice: underOutcome.price,
    overAmericanOdds,
    underAmericanOdds,
    overAdjusted,
    underAdjusted
  };
};

// Get market average for totals
const getMarketAverageTotals = (game: Game) => {
  const otherBooks = game.bookmakers.filter(b => b.key !== selectedBook);
  if (otherBooks.length === 0) return null;

  let totalSum = 0;
  let count = 0;

  otherBooks.forEach(bookmaker => {
    const totalsMarket = bookmaker.markets.find(m => m.key === 'totals');
    if (totalsMarket) {
      const overOutcome = totalsMarket.outcomes.find(o => o.name === 'Over');
      if (overOutcome && overOutcome.point !== undefined) {
        const adjusted = calculateJuiceAdjustedValue(overOutcome.point, overOutcome.price);
        totalSum += adjusted;
        count++;
      }
    }
  });

  return count > 0 ? totalSum / count : null;
};

 // Calculate all value opportunities
const getTopValuePlays = (): Array<{
  game: Game;
  team: string;
  spread: number;
  price: number;
  adjustedSpread: number;
  marketAvg: number;
  valueDiff: number;
}> => {
  const plays: Array<{
    game: Game;
    team: string;
    spread: number;
    price: number;
    adjustedSpread: number;
    marketAvg: number;
    valueDiff: number;
  }> = [];

  // Filter to only today's games
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  const todaysGames = showTodayOnly 
  ? games.filter(game => {
      const gameTime = new Date(game.commence_time);
      return gameTime >= todayStart && gameTime < todayEnd;
    })
  : games; // If showTodayOnly is false, use all games

  todaysGames.forEach(game => {
    // Check home team
    const homeData = getBookSpreadData(game, game.home_team);
    const homeMarketAvg = getMarketAverageAdjustedSpread(game, game.home_team);
    if (homeData && homeMarketAvg !== null) {
      const homeValueDiff = homeData.adjustedSpread - homeMarketAvg;
      plays.push({
        game,
        team: game.home_team,
        spread: homeData.spread,
        price: homeData.price,
        adjustedSpread: homeData.adjustedSpread,
        marketAvg: homeMarketAvg,
        valueDiff: homeValueDiff
      });
    }

// Check away team
    const awayData = getBookSpreadData(game, game.away_team);
    const awayMarketAvg = getMarketAverageAdjustedSpread(game, game.away_team);
    if (awayData && awayMarketAvg !== null) {
      const awayValueDiff = awayData.adjustedSpread - awayMarketAvg;
      plays.push({
        game,
        team: game.away_team,
        spread: awayData.spread,
        price: awayData.price,
        adjustedSpread: awayData.adjustedSpread,
        marketAvg: awayMarketAvg,
        valueDiff: awayValueDiff
      });
    }

    // ADD TOTALS HERE:
    const totalsData = getBookTotalsData(game, 'home');
    const totalsMarketAvg = getMarketAverageTotals(game);
    
    if (totalsData && totalsMarketAvg !== null) {
      // Over value
      const overValueDiff = totalsMarketAvg - totalsData.overAdjusted;
      plays.push({
        game,
        team: `Over ${totalsData.total}`,
        spread: totalsData.total,
        price: totalsData.overPrice,
        adjustedSpread: totalsData.overAdjusted,
        marketAvg: totalsMarketAvg,
        valueDiff: overValueDiff
      });

      // Under value
      const underValueDiff = totalsData.underAdjusted - totalsMarketAvg;
      plays.push({
        game,
        team: `Under ${totalsData.total}`,
        spread: -totalsData.total,
        price: totalsData.underPrice,
        adjustedSpread: totalsData.underAdjusted,
        marketAvg: totalsMarketAvg,
        valueDiff: underValueDiff
      });
    }
  });

  return plays.sort((a, b) => b.valueDiff - a.valueDiff).slice(0, 10);
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

    {/* Search Bar */}
    <div className="mb-6">
      <label className="block text-sm font-medium mb-2">Search Teams:</label>
      <input
        type="text"
        placeholder="Search by team name..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="border rounded px-4 py-2 w-64"
      />
      {searchTerm && (
        <button
          onClick={() => setSearchTerm('')}
          className="ml-2 text-sm text-blue-600 hover:text-blue-800"
        >
          Clear
        </button>
      )}
    </div>

    {/* ADD THIS TOGGLE */}
    <div className="mb-6">
      <label className="block text-sm font-medium mb-2">Top 10 Filter:</label>
      <div className="flex gap-2">
        <button
          onClick={() => setShowTodayOnly(true)}
          className={`px-4 py-2 rounded ${
            showTodayOnly 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Today's Games
        </button>
        <button
          onClick={() => setShowTodayOnly(false)}
          className={`px-4 py-2 rounded ${
            !showTodayOnly 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          All Games
        </button>
      </div>
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

    {games
      .filter(game => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
          game.home_team.toLowerCase().includes(search) ||
          game.away_team.toLowerCase().includes(search)
        );
      })

      .sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime())
      

.map((game) => {
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

      {/* TOTALS SECTION */}
      <div className="mt-4 border-t pt-4">
        <h3 className="font-semibold mb-3">Game Total</h3>
        {(() => {
          const totalsData = getBookTotalsData(game, 'home');
          const totalsMarketAvg = getMarketAverageTotals(game);
          const overValueDiff = totalsData && totalsMarketAvg !== null 
            ? totalsMarketAvg - totalsData.overAdjusted
            : null;
          const underValueDiff = totalsData && totalsMarketAvg !== null 
            ? totalsData.underAdjusted - totalsMarketAvg 
            : null;

          return totalsData ? (
            <div className="grid grid-cols-2 gap-4">
              {/* Over */}
              <div className="border rounded p-4">
                <h4 className="font-semibold mb-2">Over {totalsData.total}</h4>
                <p className="text-sm">
                  <span className="text-gray-600">Odds:</span>{' '}
                  <span className="font-medium">
                    {totalsData.overAmericanOdds > 0 ? '+' : ''}{totalsData.overAmericanOdds}
                  </span>
                </p>
                <p className="text-sm">
                  <span className="text-gray-600">Juice-Adjusted:</span>{' '}
                  <span className="font-medium">{totalsData.overAdjusted.toFixed(2)}</span>
                </p>
                <p className="text-sm">
                  <span className="text-gray-600">Market Avg:</span>{' '}
                  <span>{totalsMarketAvg !== null ? totalsMarketAvg.toFixed(2) : 'N/A'}</span>
                </p>
                {overValueDiff !== null && (
                  <div className={`text-sm font-bold p-2 rounded mt-2 ${
                    overValueDiff > 0.15 ? 'bg-green-100 text-green-700' : 
                    overValueDiff < -0.15 ? 'bg-red-100 text-red-700' : 
                    'bg-gray-100 text-gray-700'
                  }`}>
                    Value: {overValueDiff > 0 ? '+' : ''}{overValueDiff.toFixed(2)} pts
                    {overValueDiff > 0.15 && ' ✓ GOOD VALUE'}
                    {overValueDiff < -0.15 && ' ✗ Poor value'}
                  </div>
                )}
              </div>

              {/* Under */}
              <div className="border rounded p-4">
                <h4 className="font-semibold mb-2">Under {totalsData.total}</h4>
                <p className="text-sm">
                  <span className="text-gray-600">Odds:</span>{' '}
                  <span className="font-medium">
                    {totalsData.underAmericanOdds > 0 ? '+' : ''}{totalsData.underAmericanOdds}
                  </span>
                </p>
                <p className="text-sm">
                  <span className="text-gray-600">Juice-Adjusted:</span>{' '}
                  <span className="font-medium">{totalsData.underAdjusted.toFixed(2)}</span>
                </p>
                <p className="text-sm">
                  <span className="text-gray-600">Market Avg:</span>{' '}
                  <span>{totalsMarketAvg !== null ? totalsMarketAvg.toFixed(2) : 'N/A'}</span>
                </p>
                {underValueDiff !== null && (
                  <div className={`text-sm font-bold p-2 rounded mt-2 ${
                    underValueDiff > 0.15 ? 'bg-green-100 text-green-700' : 
                    underValueDiff < -0.15 ? 'bg-red-100 text-red-700' : 
                    'bg-gray-100 text-gray-700'
                  }`}>
                    Value: {underValueDiff > 0 ? '+' : ''}{underValueDiff.toFixed(2)} pts
                    {underValueDiff > 0.15 && ' ✓ GOOD VALUE'}
                    {underValueDiff < -0.15 && ' ✗ Poor value'}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No totals data available</p>
          );
        })()}
      </div>

    </div>
  );
})}
      </div>
    )}
    </div>
  );
}