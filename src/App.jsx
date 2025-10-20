import { useState } from 'react';
import { fetchStock } from './lib/api';

export default function App() {
  const [ticker, setTicker] = useState("AAPL");
  const [period, setPeriod] = useState("1mo");
  const [interval, setInterval] = useState("1d");
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState(null);
  const [err, setErr] = useState("");

  async function onLoad() {
    setErr(""); setLoading(true);
    try {
      const data = await fetchStock(ticker, period, interval);
      setMeta(data.meta);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, color: "#eee", background: "#111", minHeight: "100vh" }}>
      <h1>Trading Dashboard</h1>
      <div style={{display:"grid", gridTemplateColumns:"120px 120px 120px 140px", gap:12, alignItems:"center"}}>
        <input value={ticker} onChange={e=>setTicker(e.target.value)} placeholder="Ticker" />
        <select value={period} onChange={e=>setPeriod(e.target.value)}>
          {["1d","5d","30d","1mo","3mo","6mo","1y","2y","5y","10y","ytd","max"].map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <select value={interval} onChange={e=>setInterval(e.target.value)}>
          {["1m","2m","5m","15m","30m","60m","90m","1h","1d","5d","1wk","1mo","3mo"].map(i=><option key={i} value={i}>{i}</option>)}
        </select>
        <button onClick={onLoad} disabled={loading} style={{padding:"8px 12px"}}>{loading?"Lädt...":"Laden"}</button>
      </div>

      {err && <p style={{color:"#ff6"}}>Fehler: {err}</p>}
      {meta && (
        <pre style={{marginTop:16, background:"#222", padding:12, borderRadius:8}}>
{JSON.stringify(meta, null, 2)}
        </pre>
      )}
    </div>
  );
}
