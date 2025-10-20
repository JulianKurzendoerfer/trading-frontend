import { API_BASE } from '../config.js';

export async function fetchStock(ticker, period, interval) {
  const qs = new URLSearchParams({ ticker });
  if (period) qs.set('period', period);
  if (interval) qs.set('interval', interval);

  const url = `${API_BASE}/api/stock?${qs.toString()}`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });

  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const msg = (body && body.error) ? body.error : `API ${res.status}`;
    throw new Error(msg);
  }
  if (!body || !body.data) {
    throw new Error('Leere Antwort vom Backend');
  }
  return body; // enthält u.a. used_period / used_interval
}
