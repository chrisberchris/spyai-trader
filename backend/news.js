const axios = require('axios');

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const BASE = 'https://finnhub.io/api/v1';

// Keywords that indicate market-moving macro relevance for SPY
const BULLISH_KEYWORDS = [
  'beats', 'beat', 'surges', 'rally', 'rallies', 'strong', 'jumps', 'rises',
  'record high', 'better than expected', 'exceeds', 'upgraded', 'rate cut',
  'stimulus', 'growth', 'hiring', 'jobs added', 'gdp up', 'inflation eases',
  'dovish', 'soft landing', 'expansion'
];
const BEARISH_KEYWORDS = [
  'misses', 'miss', 'falls', 'drops', 'plunges', 'weak', 'concern', 'fear',
  'worse than expected', 'downgraded', 'rate hike', 'recession', 'layoffs',
  'inflation rises', 'gdp down', 'hawkish', 'contraction', 'sell-off',
  'crisis', 'default', 'tariff', 'slowdown', 'disappoints'
];

function scoreHeadline(headline) {
  const lower = headline.toLowerCase();
  let score = 0;
  BULLISH_KEYWORDS.forEach(k => { if (lower.includes(k)) score += 1; });
  BEARISH_KEYWORDS.forEach(k => { if (lower.includes(k)) score -= 1; });
  if (score > 0) return 'BULLISH';
  if (score < 0) return 'BEARISH';
  return 'NEUTRAL';
}

function calcOverallSentiment(articles) {
  if (!articles.length) return { score: 0, label: 'NEUTRAL', bullish: 0, bearish: 0, neutral: 0 };
  let bull = 0, bear = 0, neut = 0;
  articles.forEach(a => {
    if (a.sentiment === 'BULLISH') bull++;
    else if (a.sentiment === 'BEARISH') bear++;
    else neut++;
  });
  const score = parseFloat(((bull - bear) / articles.length).toFixed(2));
  const label = score > 0.15 ? 'BULLISH' : score < -0.15 ? 'BEARISH' : 'NEUTRAL';
  return { score, label, bullish: bull, bearish: bear, neutral: neut, total: articles.length };
}

async function getMarketNews() {
  try {
    // Finnhub general market news
    const res = await axios.get(`${BASE}/news`, {
      params: { category: 'general', token: FINNHUB_KEY },
      timeout: 6000
    });

    const articles = (res.data || [])
      .slice(0, 30)
      .filter(a => a.headline && a.summary)
      .map(a => ({
        id: a.id,
        headline: a.headline,
        summary: a.summary?.slice(0, 200),
        source: a.source,
        url: a.url,
        sentiment: scoreHeadline(a.headline + ' ' + (a.summary || '')),
        publishedAt: new Date(a.datetime * 1000).toISOString(),
        image: a.image || null
      }))
      .slice(0, 15);

    const overall = calcOverallSentiment(articles);
    return { articles, overall, source: 'finnhub', fetchedAt: new Date().toISOString() };
  } catch (err) {
    console.error('Finnhub news error:', err.message);
    // Fallback: Yahoo Finance RSS via fetch
    return await getYahooNews();
  }
}

async function getSpyNews() {
  try {
    const res = await axios.get(`${BASE}/company-news`, {
      params: {
        symbol: 'SPY',
        from: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0],
        token: FINNHUB_KEY
      },
      timeout: 6000
    });

    const articles = (res.data || [])
      .filter(a => a.headline)
      .map(a => ({
        id: a.id,
        headline: a.headline,
        summary: a.summary?.slice(0, 200),
        source: a.source,
        url: a.url,
        sentiment: scoreHeadline(a.headline + ' ' + (a.summary || '')),
        publishedAt: new Date(a.datetime * 1000).toISOString()
      }))
      .slice(0, 10);

    return articles;
  } catch (err) {
    console.error('SPY news error:', err.message);
    return [];
  }
}

async function getYahooNews() {
  // Fallback using Yahoo Finance chart metadata (no extra API key needed)
  try {
    const res = await axios.get(
      'https://query1.finance.yahoo.com/v8/finance/chart/SPY',
      { params: { interval: '1d', range: '1d' }, timeout: 5000 }
    );
    // Yahoo doesn't give news in this endpoint but we can return a graceful empty
    return {
      articles: [],
      overall: { score: 0, label: 'NEUTRAL', bullish: 0, bearish: 0, neutral: 0, total: 0 },
      source: 'fallback',
      fetchedAt: new Date().toISOString(),
      error: 'Finnhub unavailable — add FINNHUB_API_KEY for live news'
    };
  } catch {
    return {
      articles: [],
      overall: { score: 0, label: 'NEUTRAL', bullish: 0, bearish: 0, neutral: 0, total: 0 },
      source: 'unavailable',
      fetchedAt: new Date().toISOString(),
      error: 'News data unavailable'
    };
  }
}

async function getEconomicCalendar() {
  try {
    const res = await axios.get(`${BASE}/calendar/economic`, {
      params: { token: FINNHUB_KEY },
      timeout: 6000
    });

    const HIGH_IMPACT = [
      'fed', 'federal reserve', 'fomc', 'interest rate', 'cpi', 'inflation',
      'nfp', 'non-farm', 'jobs', 'unemployment', 'gdp', 'pce', 'ppi',
      'retail sales', 'ism', 'manufacturing'
    ];

    const now = Date.now();
    const in48h = now + 48 * 3600 * 1000;

    const upcoming = (res.data?.economicCalendar || [])
      .filter(e => {
        const t = new Date(e.time).getTime();
        return t >= now && t <= in48h;
      })
      .filter(e => HIGH_IMPACT.some(k => (e.event || '').toLowerCase().includes(k)))
      .map(e => ({
        event: e.event,
        time: e.time,
        country: e.country,
        impact: e.impact || 'high',
        actual: e.actual,
        estimate: e.estimate,
        previous: e.previous
      }))
      .slice(0, 5);

    return {
      events: upcoming,
      hasHighImpact: upcoming.length > 0,
      fetchedAt: new Date().toISOString()
    };
  } catch (err) {
    console.error('Calendar error:', err.message);
    return { events: [], hasHighImpact: false, fetchedAt: new Date().toISOString() };
  }
}

// Summarise news context for the AI prompt
function buildNewsContext({ articles, overall, calendarEvents }) {
  if (!articles?.length) return 'No live news data available.';

  const top5 = articles.slice(0, 5);
  const headlines = top5.map(a => `- [${a.sentiment}] ${a.headline}`).join('\n');
  const calendarStr = calendarEvents?.length
    ? `\nUpcoming high-impact events (next 48h):\n${calendarEvents.map(e => `- ${e.event} at ${e.time}`).join('\n')}`
    : '\nNo major economic events in next 48 hours.';

  return `Overall market sentiment: ${overall.label} (score: ${overall.score}, ${overall.bullish} bullish / ${overall.bearish} bearish / ${overall.neutral} neutral from ${overall.total} headlines)

Top headlines:
${headlines}
${calendarStr}`;
}

module.exports = {
  getMarketNews,
  getSpyNews,
  getEconomicCalendar,
  buildNewsContext,
  calcOverallSentiment
};
