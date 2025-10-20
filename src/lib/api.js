import { API_BASE } from '../config.js';

export async function fetchStock(ticker, period, interval) {
  const qs = new URLSearchParams();
  if (ticker)   qs.set('ticker', ticker.trim().toUpperCase());
  if (period)   qs.set('period', period);
  if (interval) qs.set('interval', interval);

  // /api/stock?...
  const url = `${API_BASE}/api/stock?${qs.toString()}`;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort('timeout'), 15000);

  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: ctl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data && data.error) {
      // Backend liefert Klartext-Fehler -> als Exception hochwerfen
      const what = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
      throw new Error(what);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}
