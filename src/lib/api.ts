export const API_BASE =
  (import.meta.env.VITE_API_BASE?.replace(/\/$/, '')) ||
  (() => {
    try {
      const parts = window.location.hostname.split('.');
      const root = parts.slice(-2).join('.'); // z.B. market-vision-pro.com
      return `https://api.${root}`;
    } catch {
      return '';
    }
  })();

export type Point = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export async function health(): Promise<boolean> {
  const r = await fetch(`${API_BASE}/api/health`, { method: 'GET' });
  return r.ok;
}

export async function loadStock(
  ticker: string,
  period = '1y',
  interval = '1d'
): Promise<Point[]> {
  const url = `${API_BASE}/api/stock?ticker=${encodeURIComponent(ticker)}&period=${encodeURIComponent(period)}&interval=${encodeURIComponent(interval)}`;
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  return Array.isArray(j?.points) ? j.points : [];
}
