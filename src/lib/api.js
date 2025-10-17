export const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export async function fetchIndicators({ ticker="AAPL", period="1y", interval="1d", adj=true }) {
  const url = `${API_BASE}/api/indicators?ticker=${encodeURIComponent(ticker)}&period=${encodeURIComponent(period)}&interval=${encodeURIComponent(interval)}&adj=${adj}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json();
}

export async function fetchMonteCarlo({ ticker="AAPL", period="1y", interval="1d", horizon_steps=60, nsim=10000, adj=true }) {
  const url = `${API_BASE}/api/montecarlo?ticker=${encodeURIComponent(ticker)}&period=${encodeURIComponent(period)}&interval=${encodeURIComponent(interval)}&horizon_steps=${horizon_steps}&nsim=${nsim}&adj=${adj}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json();
}
