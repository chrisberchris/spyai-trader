const axios = require('axios');

// Thresholds for "unusual" activity
const UNUSUAL_VOLUME_RATIO  = 3.0;
const UNUSUAL_OI_MIN        = 500;
const UNUSUAL_VOLUME_MIN    = 100;
const MAX_CONTRACTS         = 30;

// Full browser-like headers — Yahoo blocks server requests without these
const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://finance.yahoo.com/',
  'Origin': 'https://finance.yahoo.com',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-site',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
};

// Retry helper — retries once on 401/429 with a short delay
async function yahooFetch(url, params, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await axios.get(url, {
        params,
        headers: YAHOO_HEADERS,
        timeout: 10000,
      });
      return res;
    } catch (err) {
      const status = err.response?.status;
      if ((status === 401 || status === 429) && attempt < retries) {
        // Wait 1s then try alternate Yahoo endpoint
        await new Promise(r => setTimeout(r, 1000));
        // Toggle between query1 and query2 on retry
        url = url.includes('query2')
          ? url.replace('query2', 'query1')
          : url.replace('query1', 'query2');
        continue;
      }
      throw err;
    }
  }
}

async function getOptionsFlow(symbol = 'SPY') {
  try {
    // Fetch options chain from Yahoo Finance
    const res = await yahooFetch(
      `https://query2.finance.yahoo.com/v7/finance/options/${symbol}`,
      { getAllData: true }
    );

    const result    = res.data?.optionChain?.result?.[0];
    if (!result) return null;

    const spotPrice = result.quote?.regularMarketPrice || 0;
    const expDates  = result.expirationDates || [];

    // Fetch first 4 expiry dates for broader coverage
    const expiryResults = await Promise.allSettled(
      expDates.slice(0, 4).map(exp =>
        yahooFetch(
          `https://query2.finance.yahoo.com/v7/finance/options/${symbol}`,
          { date: exp }
        )
      )
    );

    const allCalls = [];
    const allPuts  = [];

    for (const r of expiryResults) {
      if (r.status !== 'fulfilled') continue;
      const chain = r.value.data?.optionChain?.result?.[0]?.options?.[0];
      if (!chain) continue;
      allCalls.push(...(chain.calls || []));
      allPuts.push(...(chain.puts  || []));
    }

    // Score each contract for unusualness
    function scoreContracts(contracts, type) {
      return contracts
        .filter(c => (c.openInterest || 0) >= UNUSUAL_OI_MIN && (c.volume || 0) >= UNUSUAL_VOLUME_MIN)
        .map(c => {
          const volToOI   = c.openInterest > 0 ? (c.volume || 0) / c.openInterest : 0;
          const moneyness = spotPrice > 0 ? ((c.strike - spotPrice) / spotPrice * 100) : 0;
          const daysToExp = c.expiration
            ? Math.max(0, Math.round((c.expiration * 1000 - Date.now()) / 86400000))
            : null;

          // Unusualness score: higher = more unusual
          const score = (
            (volToOI >= UNUSUAL_VOLUME_RATIO ? volToOI * 2 : 0) +
            (c.volume || 0) / 1000 +
            (c.openInterest || 0) / 5000
          );

          return {
            type,
            strike:       c.strike,
            expiry:       daysToExp !== null ? `${daysToExp}d` : 'unknown',
            expiryDate:   c.expiration ? new Date(c.expiration * 1000).toISOString().split('T')[0] : null,
            volume:       c.volume || 0,
            openInterest: c.openInterest || 0,
            volToOI:      parseFloat(volToOI.toFixed(2)),
            impliedVol:   c.impliedVolatility ? parseFloat((c.impliedVolatility * 100).toFixed(1)) : null,
            lastPrice:    c.lastPrice || 0,
            moneyness:    parseFloat(moneyness.toFixed(2)),
            inTheMoney:   c.inTheMoney || false,
            score:        parseFloat(score.toFixed(2)),
            unusual:      volToOI >= UNUSUAL_VOLUME_RATIO,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_CONTRACTS);
    }

    const scoredCalls = scoreContracts(allCalls, 'CALL');
    const scoredPuts  = scoreContracts(allPuts,  'PUT');

    // Unusual contracts only
    const unusualCalls = scoredCalls.filter(c => c.unusual).slice(0, 10);
    const unusualPuts  = scoredPuts.filter(c => c.unusual).slice(0, 10);

    // Aggregate metrics
    const totalCallVol = allCalls.reduce((s, c) => s + (c.volume || 0), 0);
    const totalPutVol  = allPuts.reduce((s, c) =>  s + (c.volume || 0), 0);
    const putCallRatio = totalCallVol > 0
      ? parseFloat((totalPutVol / totalCallVol).toFixed(2))
      : null;

    const totalCallOI = allCalls.reduce((s, c) => s + (c.openInterest || 0), 0);
    const totalPutOI  = allPuts.reduce((s, c) =>  s + (c.openInterest || 0), 0);
    const putCallOIRatio = totalCallOI > 0
      ? parseFloat((totalPutOI / totalCallOI).toFixed(2))
      : null;

    // Directional bias from options flow
    let flowBias = 'NEUTRAL';
    let flowSignal = 'NEUTRAL';
    if (putCallRatio !== null) {
      if      (putCallRatio > 1.5) { flowBias = 'BEARISH';       flowSignal = 'STRONG_PUT_BUYING'; }
      else if (putCallRatio > 1.2) { flowBias = 'MILD_BEARISH';  flowSignal = 'ELEVATED_PUT_BUYING'; }
      else if (putCallRatio < 0.7) { flowBias = 'BULLISH';       flowSignal = 'STRONG_CALL_BUYING'; }
      else if (putCallRatio < 0.9) { flowBias = 'MILD_BULLISH';  flowSignal = 'ELEVATED_CALL_BUYING'; }
    }

    // Unusual activity summary
    const hasUnusualCalls = unusualCalls.length > 0;
    const hasUnusualPuts  = unusualPuts.length  > 0;
    let unusualSummary = 'No unusual options activity detected.';
    if (hasUnusualCalls && hasUnusualPuts) {
      unusualSummary = `Unusual activity on both calls and puts — mixed institutional positioning.`;
    } else if (hasUnusualCalls) {
      unusualSummary = `Unusual call buying detected — ${unusualCalls.length} contracts with volume/OI ratio above ${UNUSUAL_VOLUME_RATIO}x.`;
    } else if (hasUnusualPuts) {
      unusualSummary = `Unusual put buying detected — ${unusualPuts.length} contracts with volume/OI ratio above ${UNUSUAL_VOLUME_RATIO}x.`;
    }

    // Confidence modifier
    let confidenceModifier = 0;
    if      (flowBias === 'BEARISH'      && hasUnusualPuts)  confidenceModifier = -12;
    else if (flowBias === 'MILD_BEARISH' && hasUnusualPuts)  confidenceModifier = -6;
    else if (flowBias === 'BULLISH'      && hasUnusualCalls) confidenceModifier = +12;
    else if (flowBias === 'MILD_BULLISH' && hasUnusualCalls) confidenceModifier = +6;

    return {
      spotPrice,
      putCallRatio,
      putCallOIRatio,
      totalCallVol,
      totalPutVol,
      totalCallOI,
      totalPutOI,
      flowBias,
      flowSignal,
      unusualCalls,
      unusualPuts,
      topCalls:       scoredCalls.slice(0, 5),
      topPuts:        scoredPuts.slice(0, 5),
      unusualSummary,
      hasUnusualActivity: hasUnusualCalls || hasUnusualPuts,
      confidenceModifier,
      source:         'yahoo',
      fetchedAt:      new Date().toISOString()
    };
  } catch (err) {
    console.error('Options flow error:', err.message);
    return null;
  }
}

// Build options flow context string for AI prompt
function buildOptionsFlowContext(flow) {
  if (!flow) return 'Options flow data unavailable.';

  const lines = [
    `Put/Call volume ratio: ${flow.putCallRatio ?? 'N/A'} — Flow bias: ${flow.flowBias}`,
    `Total call volume: ${flow.totalCallVol?.toLocaleString() ?? 'N/A'} | Total put volume: ${flow.totalPutVol?.toLocaleString() ?? 'N/A'}`,
    `Put/Call OI ratio: ${flow.putCallOIRatio ?? 'N/A'}`,
    flow.unusualSummary,
  ];

  if (flow.unusualCalls.length > 0) {
    const top = flow.unusualCalls[0];
    lines.push(`Largest unusual call: $${top.strike} strike, ${top.expiry} to expiry, vol/OI: ${top.volToOI}x, IV: ${top.impliedVol}%`);
  }
  if (flow.unusualPuts.length > 0) {
    const top = flow.unusualPuts[0];
    lines.push(`Largest unusual put: $${top.strike} strike, ${top.expiry} to expiry, vol/OI: ${top.volToOI}x, IV: ${top.impliedVol}%`);
  }

  lines.push(`Confidence modifier from options flow: ${flow.confidenceModifier > 0 ? '+' : ''}${flow.confidenceModifier} points`);

  return lines.join('\n');
}

module.exports = { getOptionsFlow, buildOptionsFlowContext };
