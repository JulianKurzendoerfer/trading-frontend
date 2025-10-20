import { useState } from 'react';
import { fetchStock } from '../lib/api.js';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';

const PERIODS  = ['1mo','3mo','6mo','1y','2y','5y','max'];
const INTERVALS = ['1d','1wk','1mo'];

function toSeries(json) {
  const idx   = json?.index  ?? [];
  const close = json?.Close  ?? [];
  const out = [];
  const n = Math.min(idx.length, close.length);
  for (let i = 0; i < n; i++) {
    const ts = String(idx[i]);
    out.push({
      t: ts.length >= 10 ? ts.slice(0,10) : ts,   // kompakte Datumsskala
      close: Number(close[i]),
    });
  }
  return out;
}

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

  const series = payload ? toSeries(payload) : [];

  return (
    <div style={{padding:'24px', color:'#eee', maxWidth: 1100}}>
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

      {/* Meta-Infos vom Backend */}
      {payload && (
        <div style={{fontSize:13, color:'#bbb', marginBottom:8}}>
          Quelle: <b>{payload.source ?? '—'}</b>
          {' · '}Period verwendet: <b>{payload.used_period ?? period}</b>
          {' · '}Interval verwendet: <b>{payload.used_interval ?? interval}</b>
        </div>
      )}

      {/* Fehlerhinweis */}
      {err && <div style={{color:'#ffeb3b', marginTop:8}}>Fehler: {err}</div>}

      {/* Chart */}
      {series.length > 0 && (
        <div style={{height: 380, background:'#0c0c0c', border:'1px solid #222', borderRadius:8, padding:'8px'}}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis dataKey="t" tick={{ fill:'#aaa', fontSize: 12 }} />
              <YAxis tick={{ fill:'#aaa', fontSize: 12 }} domain={['auto','auto']} />
              <Tooltip contentStyle={{ background:'#111', border:'1px solid #333', color:'#eee' }}/>
              <Line type="monotone" dataKey="close" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Debug-JSON einklappbar */}
      {payload && (
        <details style={{marginTop:14}}>
          <summary style={{cursor:'pointer'}}>Debug: Rohdaten anzeigen</summary>
          <pre style={{marginTop:12, background:'#111', padding:'12px', border:'1px solid #333', borderRadius:8, maxHeight:400, overflow:'auto'}}>
{JSON.stringify(payload, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
