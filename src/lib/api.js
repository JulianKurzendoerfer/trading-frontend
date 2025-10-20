import { API_BASE } from '../config.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function wakeBackend(signal) {
  try {
    const res = await fetch(`${API_BASE}/`, { cache: 'no-store', signal });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchJSON(url, { retries = 4, backoff = 500 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) return await res.json();

      // Text hilft beim Debuggen in der UI
      const text = await res.text().catch(() => '');
      lastErr = new Error(`HTTP ${res.status} ${text?.slice(0,180)}`);

      // Bei 502/503 oder 504 erneut versuchen (Cold-Start/Boot)
      if ([502, 503, 504].includes(res.status)) {
        await sleep(backoff); backoff *= 2; continue;
      }
      break; // andere Status: nicht endlos retryen
    } catch (e) {
      // Netzfehler/Timeout ⇒ retry mit Backoff
      lastErr = e;
      await sleep(backoff); backoff *= 2;
    }
  }
  throw lastErr;
}

export async function fetchStock(ticker, period, interval) {
  // 1) Backend „anpingen“ (weckt Render Free sicher auf)
  const ctrl = new AbortController();
  await wakeBackend(ctrl.signal);
  // kleine Pause, damit Gunicorn/Worker wirklich bereit sind
  await sleep(300);

  // 2) Daten holen (Server testet selbst Fallback-Kombis, wenn period/interval leer liefern)
  const qs = new URLSearchParams({ ticker });
  if (period) qs.set('period', period);
  if (interval) qs.set('interval', interval);

  const url = `${API_BASE}/api/stock?${qs.toString()}`;
  return await fetchJSON(url, { retries: 4, backoff: 600 });
}
