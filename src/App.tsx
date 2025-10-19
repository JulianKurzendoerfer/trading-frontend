import { useState } from 'react';
import { fetchStock } from './lib/api';

type Period = '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y';
type Interval = '1d' | '1wk' | '1mo';

export default function App() {
  const [ticker, setTicker] = useState('AAPL');
  const [period, setPeriod] = useState<Period>('1y');
  const [interval, setInterval] = useState<Interval>('1d');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      setData(null);
      const result = await fetchStock(ticker, period, interval);
      setData(result);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ color: '#eee', background: '#121212', minHeight: '100vh', padding: '32px', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial, "Apple Color Emoji", "Segoe UI Emoji"' }}>
      <h1 style={{ fontSize: 42, margin: '0 0 24px' }}>Trading Dashboard</h1>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
        <label>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Ticker</div>
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            style={{ padding: '6px 10px', borderRadius: 8 }}
          />
        </label>

        <label>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Period</div>
          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} style={{ padding: '6px 10px', borderRadius: 8 }}>
            <option value="1mo">1m</option>
            <option value="3mo">3m</option>
            <option value="6mo">6m</option>
            <option value="1y">1y</option>
            <option value="2y">2y</option>
            <option value="5y">5y</option>
          </select>
        </label>

        <label>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Interval</div>
          <select value={interval} onChange={(e) => setInterval(e.target.value as Interval)} style={{ padding: '6px 10px', borderRadius: 8 }}>
            <option value="1d">1d</option>
            <option value="1wk">1w</option>
            <option value="1mo">1m</option>
          </select>
        </label>

        <button onClick={load} disabled={loading} style={{ padding: '8px 14px', borderRadius: 10, background: '#2e7d32', color: 'white', fontWeight: 600, border: 0 }}>
          {loading ? 'Lädt…' : 'Laden'}
        </button>
      </div>

      {error && (
        <div style={{ color: '#ff6b6b', marginTop: 8 }}>
          <strong>Fehler:</strong> {error}
        </div>
      )}

      {data && (
        <div style={{ marginTop: 24 }}>
          <div style={{ opacity: 0.8, marginBottom: 8 }}>Antwort (gekürzt angezeigt):</div>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#1e1e1e', padding: 16, borderRadius: 12, maxHeight: 400, overflow: 'auto' }}>
            {JSON.stringify(
              {
                columns: Object.keys(data ?? {}),
                // zeig ein paar Spalten-Längen, damit man sieht, dass Daten da sind
                sizes: Object.fromEntries(
                  Object.entries(data ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v.length : (typeof v === 'object' ? Object.keys(v as any).length : 0)])
                ),
              },
              null,
              2
            )}
          </pre>
        </div>
      )}
    </div>
  );
}
