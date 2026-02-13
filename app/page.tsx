import Link from 'next/link';

export default function Home() {
  const sports = [
    { href: '/nba', emoji: '🏀', title: 'NBA', desc: 'Professional Basketball' },
    { href: '/ncaa-mbk', emoji: '🎓', title: "NCAA Men's Basketball", desc: 'College Basketball' },
    { href: '/ncaa-wbk', emoji: '🏀', title: "NCAA Women's Basketball", desc: 'College Basketball' },
    { href: '/wnba', emoji: '🏀', title: 'WNBA', desc: "Women's Basketball" },
    { href: '/nfl', emoji: '🏈', title: 'NFL', desc: 'Professional Football' },
    { href: '/ncaa-fb', emoji: '🎓', title: 'NCAA Football', desc: 'College Football' },
    { href: '/mlb', emoji: '⚾', title: 'MLB', desc: 'Baseball' },
    { href: '/nhl', emoji: '🏒', title: 'NHL', desc: 'Hockey' },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-5xl font-bold mb-4">Sports Betting Odds Comparison</h1>
      <p className="text-gray-600 mb-8">Select a sport to compare odds and find value</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sports.map(sport => (
          <Link 
            key={sport.href}
            href={sport.href}
            className="border rounded-lg p-6 hover:bg-gray-50 hover:shadow-lg transition"
          >
            <h2 className="text-2xl font-bold">
              {sport.emoji} {sport.title}
            </h2>
            <p className="text-gray-600">{sport.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}