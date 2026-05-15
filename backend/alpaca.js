const axios = require('axios');

const BASE_URL = 'https://paper-api.alpaca.markets';
const DATA_URL = 'https://data.alpaca.markets';

function alpacaClient() {
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      'APCA-API-KEY-ID':     process.env.ALPACA_API_KEY,
      'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY,
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  });
}

function alpacaDataClient() {
  return axios.create({
    baseURL: DATA_URL,
    headers: {
      'APCA-API-KEY-ID':     process.env.ALPACA_API_KEY,
      'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY,
    },
    timeout: 10000,
  });
}

// ─── Account ─────────────────────────────────────────────────────────────────
async function getAccount() {
  const client = alpacaClient();
  const { data } = await client.get('/v2/account');
  return {
    id:             data.id,
    status:         data.status,
    cash:           parseFloat(data.cash),
    portfolioValue: parseFloat(data.portfolio_value),
    buyingPower:    parseFloat(data.buying_power),
    equity:         parseFloat(data.equity),
    dayPL:          parseFloat(data.unrealized_pl),
    dayPLPct:       parseFloat(data.unrealized_plpc) * 100,
    patternDayTrader: data.pattern_day_trader,
    tradingBlocked: data.trading_blocked,
    accountBlocked: data.account_blocked,
  };
}

// ─── Market status ────────────────────────────────────────────────────────────
async function getMarketStatus() {
  const client = alpacaClient();
  const { data } = await client.get('/v2/clock');
  return {
    isOpen:    data.is_open,
    nextOpen:  data.next_open,
    nextClose: data.next_close,
    timestamp: data.timestamp,
  };
}

// ─── Positions ────────────────────────────────────────────────────────────────
async function getPositions() {
  const client = alpacaClient();
  const { data } = await client.get('/v2/positions');
  return data.map(p => ({
    symbol:       p.symbol,
    qty:          parseFloat(p.qty),
    side:         p.side,
    avgEntryPrice: parseFloat(p.avg_entry_price),
    currentPrice: parseFloat(p.current_price),
    marketValue:  parseFloat(p.market_value),
    unrealizedPL: parseFloat(p.unrealized_pl),
    unrealizedPLPct: parseFloat(p.unrealized_plpc) * 100,
    costBasis:    parseFloat(p.cost_basis),
  }));
}

async function getPosition(symbol) {
  try {
    const client = alpacaClient();
    const { data } = await client.get(`/v2/positions/${symbol}`);
    return {
      symbol:        data.symbol,
      qty:           parseFloat(data.qty),
      side:          data.side,
      avgEntryPrice: parseFloat(data.avg_entry_price),
      currentPrice:  parseFloat(data.current_price),
      marketValue:   parseFloat(data.market_value),
      unrealizedPL:  parseFloat(data.unrealized_pl),
      unrealizedPLPct: parseFloat(data.unrealized_plpc) * 100,
    };
  } catch (err) {
    if (err.response?.status === 404) return null; // no position
    throw err;
  }
}

// ─── Orders ───────────────────────────────────────────────────────────────────
async function placeOrder({ symbol, qty, side, type = 'market', limitPrice, stopPrice, timeInForce = 'day', clientOrderId }) {
  const client = alpacaClient();
  const body = {
    symbol,
    qty: String(qty),
    side,        // 'buy' or 'sell'
    type,        // 'market', 'limit', 'stop', 'stop_limit'
    time_in_force: timeInForce,
    ...(clientOrderId && { client_order_id: clientOrderId }),
    ...(limitPrice    && { limit_price: String(limitPrice) }),
    ...(stopPrice     && { stop_price: String(stopPrice) }),
  };
  const { data } = await client.post('/v2/orders', body);
  return {
    id:          data.id,
    clientId:    data.client_order_id,
    symbol:      data.symbol,
    qty:         parseFloat(data.qty),
    side:        data.side,
    type:        data.type,
    status:      data.status,
    filledQty:   parseFloat(data.filled_qty || 0),
    filledPrice: data.filled_avg_price ? parseFloat(data.filled_avg_price) : null,
    createdAt:   data.created_at,
  };
}

async function getOrders(status = 'all', limit = 50) {
  const client = alpacaClient();
  const { data } = await client.get('/v2/orders', { params: { status, limit, direction: 'desc' } });
  return data.map(o => ({
    id:          o.id,
    symbol:      o.symbol,
    qty:         parseFloat(o.qty),
    side:        o.side,
    type:        o.type,
    status:      o.status,
    filledQty:   parseFloat(o.filled_qty || 0),
    filledPrice: o.filled_avg_price ? parseFloat(o.filled_avg_price) : null,
    createdAt:   o.created_at,
    updatedAt:   o.updated_at,
  }));
}

async function cancelOrder(orderId) {
  const client = alpacaClient();
  await client.delete(`/v2/orders/${orderId}`);
}

async function closePosition(symbol, qty) {
  const client = alpacaClient();
  const { data } = await client.delete(`/v2/positions/${symbol}`, {
    data: qty ? { qty: String(qty) } : undefined
  });
  return data;
}

// ─── Bracket order (entry + target + stop in one) ─────────────────────────────
async function placeBracketOrder({ symbol, qty, side, limitPrice, takeProfitPrice, stopLossPrice, clientOrderId }) {
  const client = alpacaClient();
  const body = {
    symbol,
    qty: String(qty),
    side,
    type: limitPrice ? 'limit' : 'market',
    time_in_force: 'day',
    order_class: 'bracket',
    ...(limitPrice       && { limit_price: limitPrice.toFixed(2) }),
    ...(clientOrderId    && { client_order_id: clientOrderId }),
    take_profit: { limit_price: takeProfitPrice.toFixed(2) },
    stop_loss:   { stop_price: stopLossPrice.toFixed(2) },
  };
  const { data } = await client.post('/v2/orders', body);
  return {
    id:       data.id,
    symbol:   data.symbol,
    qty:      parseFloat(data.qty),
    side:     data.side,
    status:   data.status,
    legs:     data.legs,
    createdAt: data.created_at,
  };
}

// ─── Calculate position size ───────────────────────────────────────────────────
// Uses 2% of account equity per trade, adjusted by confidence score
function calcPositionSize(account, price, confidenceScore) {
  const BASE_RISK_PCT = 0.02; // 2% of account per trade

  // Scale size by position size recommendation
  const sizeMultiplier =
    confidenceScore.positionSize === 'FULL'     ? 1.0  :
    confidenceScore.positionSize === 'STANDARD' ? 0.75 :
    confidenceScore.positionSize === 'REDUCED'  ? 0.5  :
    confidenceScore.positionSize === 'SMALL'    ? 0.25 : 0;

  if (sizeMultiplier === 0) return 0;

  const dollarAmount = account.equity * BASE_RISK_PCT * sizeMultiplier;
  const shares = Math.floor(dollarAmount / price);
  return Math.max(0, shares);
}

module.exports = {
  getAccount, getMarketStatus, getPositions, getPosition,
  placeOrder, getOrders, cancelOrder, closePosition,
  placeBracketOrder, calcPositionSize
};
