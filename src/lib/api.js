// src/lib/api.js
import { API_BASE } from '../config.js';

/**
 * Flexibler Fetch:
 * - fetchStock({ ticker, period, interval })
 * - fetchStock(ticker, period, interval)
 */
export async function fetchStock(a, b, c) {
  let ticker, period, interval;

  if (typeof a === 'object' && a) {
    ({ ticker, period, interval } = a);
  } else {
    ticker = a;
    period = b;
    interval = c;
  }

  const url = `${API_BASE}/api/stock` +
    `?ticker=${encodeURIComponent(ticker)}` +
    `&period=${encodeURIComponent(period)}` +
    `&interval=${encodeURIComponent(interval)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status}`);
  }
  return await res.json();
}
