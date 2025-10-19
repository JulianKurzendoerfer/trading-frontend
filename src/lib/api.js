import { API_BASE } from '../config';

export async function fetchStock(ticker, period, interval) {
  const url = `${API_BASE}/api/stock?ticker=${encodeURIComponent(ticker)}&period=${encodeURIComponent(period)}&interval=${encodeURIComponent(interval)}`;
  const r = await fetch(url);
  if (!r.ok) {
    throw new Error(`API error ${r.status}`);
  }
  return await r.json();
}
