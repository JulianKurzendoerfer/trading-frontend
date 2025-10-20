import { useState } from 'react';
import { fetchStock } from '../lib/api.js';

const PERIODS  = ['1mo','3mo','6mo','1y','2y','5y','max'];
const INTERVALS = ['1d','1wk','1mo'];

export default function TradingDashboard() {
  const [ticker, setTicker] = useState('AAPL');
  const [period, setPeriod] = useState('1y');
  const [interval, setInterval] = useState('1d');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [payload, setPayload] = useState(null);

  async function onLoad() {
    setErr('');
    setLoading(true);
    try {
      const json = await fetchStock(ticker, period, interval);
      setPayload(json);
    } catch (e) {
      setPayload(null);
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{padding:'24px', color:'#eee'}}>
      <h1 style={{fontSize:'48px', marginBottom:'24px'}}>Trading Dashboard</h1>

      <div style={{display:'flex', gap:'12px', alignItems:'center', marginBottom:'12px'}}>
        <input
          value={ticker}
          onChange={e => setTicker(e.target.value)}
          style={{background:'#111', color:'#eee', border:'1px solid #333', padding:'6px 10px', width:120}}
          placeholder="Ticker"
        />

        <select value={period} onChange={e => setPeriod(e.target.value)}
                style={{background:'#111', color:'#eee', border:'1px solid #333', padding:'6px 10px'}}>
          {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <select value={interval} onChange={e => setInterval(e.target.value)}
                style={{background:'#111', color:'#eee', border:'1px solid #333', padding:'6px 10px'}}>
          {INTERVALS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <button onClick={onLoad} disabled={loading}
                style={{background:'#333', color:'#fff', padding:'8px 16px', border:'1px solid #555'}}>
          {loading ? 'Lädt…' : 'Laden'}
        </button>
      </div>

      {err && <div style={{color:'#ffeb3b', marginTop:8}}>Fehler: {err}</div>}

      {/* Grobe Sichtprüfung: was kommt zurück? */}
      {payload && (
        <pre style={{marginTop:16, background:'#111', padding:'12px', border:'1px solid #333', borderRadius:8}}>
{JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </div>
  );
}
