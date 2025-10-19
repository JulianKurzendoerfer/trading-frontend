import { useEffect, useMemo, useState } from "react";
import { fetchStock } from '../lib/api';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  ComposedChart, Bar, Legend
} from "recharts";

function fmtDate(d) {
  // Für Recharts: kurze Datumsskala
  try { return new Date(d).toISOString().slice(0,10); } catch { return d; }
}

export default function TradingDashboard() {
  const [ticker, setTicker] = useState("AAPL");
  const [period, setPeriod] = useState("1y");     // z.B. 6mo, 1y, 2y, 5y, max
  const [interval, setInterval] = useState("1d"); // 1d, 1wk, 1mo
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [raw, setRaw] = useState(null);           // API-Response

  async function load() {
    setLoading(true); setErr("");
    try {
const data = await fetchStock(ticker, period, interval);
      setRaw(data);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* auto initial */ }, []);

  // api response -> recharts friendly rows
  const rows = useMemo(() => {
    if (!raw) return [];
    // Erwartete Struktur:
    // { series:[{date,close}], indicators:{
    //    ema:{ema9,ema21,ema50},
    //    bollinger:{upper,lower,basis},
    //    macd:{line,signal,hist},
    //    rsi:[...],
    //    stochastic:{k,d},
    //    stoch_rsi:{k,d}
    // }}
    const ser = raw.series || [];
    const ind = raw.indicators || {};
    const ema = ind.ema || {};
    const bb  = ind.bollinger || {};
    const macd = ind.macd || {};
    const rsi = ind.rsi || [];
    const sto = ind.stochastic || {};
    const srs = ind.stoch_rsi || {};

    const n = ser.length;
    const out = [];
    for (let i=0;i<n;i++){
      out.push({
        date: fmtDate(ser[i]?.date ?? i),
        close: ser[i]?.close ?? null,
        ema9: ema.ema9?.[i] ?? null,
        ema21: ema.ema21?.[i] ?? null,
        ema50: ema.ema50?.[i] ?? null,
        bb_upper: bb.upper?.[i] ?? null,
        bb_lower: bb.lower?.[i] ?? null,
        bb_basis: bb.basis?.[i] ?? null,
        macd_line: macd.line?.[i] ?? null,
        macd_sig: macd.signal?.[i] ?? null,
        macd_hist: macd.hist?.[i] ?? null,
        rsi: rsi?.[i] ?? null,
        sto_k: sto.k?.[i] ?? null,
        sto_d: sto.d?.[i] ?? null,
        srs_k: srs.k?.[i] ?? null,
        srs_d: srs.d?.[i] ?? null,
      });
    }
    return out;
  }, [raw]);

  return (
    <div className="p-6 space-y-8 text-slate-100">
      <h1 className="text-4xl font-bold">Trading Dashboard</h1>

      <div className="flex gap-3 items-end flex-wrap">
        <div className="flex flex-col">
          <label className="text-sm">Ticker</label>
          <input value={ticker} onChange={e=>setTicker(e.target.value)}
                 className="px-3 py-2 rounded bg-slate-800 border border-slate-700" />
        </div>
        <div className="flex flex-col">
          <label className="text-sm">Period</label>
          <select value={period} onChange={e=>setPeriod(e.target.value)}
                  className="px-3 py-2 rounded bg-slate-800 border border-slate-700">
            <option>6mo</option><option>1y</option><option>2y</option>
            <option>5y</option><option>10y</option><option>max</option>
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-sm">Interval</label>
          <select value={interval} onChange={e=>setInterval(e.target.value)}
                  className="px-3 py-2 rounded bg-slate-800 border border-slate-700">
            <option>1d</option><option>1wk</option><option>1mo</option>
          </select>
        </div>
        <button onClick={load}
                className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60"
                disabled={loading}>
          {loading ? "Laden…" : "Laden"}
        </button>
        {err && <div className="text-red-400">{err}</div>}
      </div>

      {/* PRICE + BB + EMAs */}
      <section className="h-[360px] bg-slate-900 rounded-xl p-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="date" minTickGap={24} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="close" name="Close" stroke="#60a5fa" dot={false} strokeWidth={1.8}/>
            <Line type="monotone" dataKey="bb_upper" name="BB Upper" stroke="#ef4444" dot={false} strokeDasharray="4 4"/>
            <Line type="monotone" dataKey="bb_basis" name="BB Basis" stroke="#a78bfa" dot={false} strokeDasharray="2 4"/>
            <Line type="monotone" dataKey="bb_lower" name="BB Lower" stroke="#22c55e" dot={false} strokeDasharray="4 4"/>
            <Line type="monotone" dataKey="ema9"  name="EMA9"  stroke="#f59e0b" dot={false}/>
            <Line type="monotone" dataKey="ema21" name="EMA21" stroke="#34d399" dot={false}/>
            <Line type="monotone" dataKey="ema50" name="EMA50" stroke="#93c5fd" dot={false}/>
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* MACD */}
      <section className="h-[220px] bg-slate-900 rounded-xl p-3">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="date" minTickGap={24} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="macd_hist" name="MACD hist" fill="#737373" opacity={0.6}/>
            <Line type="monotone" dataKey="macd_line" name="MACD" stroke="#ff7f0e" dot={false} strokeWidth={2}/>
            <Line type="monotone" dataKey="macd_sig" name="Signal" stroke="#1f77b4" dot={false} strokeWidth={2}/>
          </ComposedChart>
        </ResponsiveContainer>
      </section>

      {/* RSI */}
      <section className="h-[180px] bg-slate-900 rounded-xl p-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="date" minTickGap={24} />
            <YAxis domain={[0,100]} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="rsi" name="RSI (14)" stroke="#e377c2" dot={false} strokeWidth={2}/>
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* Stochastic */}
      <section className="h-[180px] bg-slate-900 rounded-xl p-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="date" minTickGap={24} />
            <YAxis domain={[0,100]}/>
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="sto_k" name="Stoch %K" stroke="#9467bd" dot={false}/>
            <Line type="monotone" dataKey="sto_d" name="Stoch %D" stroke="#d62728" dot={false}/>
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* Stoch RSI */}
      <section className="h-[180px] bg-slate-900 rounded-xl p-3 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="date" minTickGap={24} />
            <YAxis domain={[0,100]}/>
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="srs_k" name="Stoch RSI %K" stroke="#22c55e" dot={false}/>
            <Line type="monotone" dataKey="srs_d" name="Stoch RSI %D" stroke="#06b6d4" dot={false}/>
          </LineChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}
