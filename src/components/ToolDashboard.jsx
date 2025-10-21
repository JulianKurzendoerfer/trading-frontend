import React, { useMemo, useState } from 'react';
import Plot from 'react-plotly.js';
import { API_BASE } from '../config.js';

const asNum = v => (v == null || v === '' ? null : Number(v));
const pickArr = (o, ...keys) => keys.map(k => o?.[k]).find(v => Array.isArray(v));
const toDates = xs => (xs || []).map(x => new Date(x));

async function fetchStock(ticker, period, interval) {
  const qs = new URLSearchParams({ ticker, period, interval }).toString();
  const url = `${API_BASE}/api/stock?${qs}`;
  for (let tryNo = 0; tryNo < 2; tryNo++) {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
      mode: 'cors',
    });
    const txt = await res.text();
    try {
      const json = JSON.parse(txt);
      if (json && (json.index || json.dates || json.Close || json.close)) {
        return { ok: true, data: json };
      }
    } catch (_) {}
    await new Promise(r => setTimeout(r, 600));
  }
  return { ok: false, error: 'no-data' };
}

// ---- Indikatoren (pure JS) ----
function ema(arr, span) {
  const a = 2 / (span + 1);
  const out = new Array(arr.length).fill(null);
  let prev = null;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (v == null) { out[i] = prev; continue; }
    prev = (prev == null) ? v : a * v + (1 - a) * prev;
    out[i] = prev;
  }
  return out;
}
function sma(arr, win) {
  const out = new Array(arr.length).fill(null);
  let s = 0, q = [];
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    q.push(v); s += (v ?? 0);
    if (q.length > win) { s -= (q.shift() ?? 0); }
    out[i] = (q.length === win ? s / win : null);
  }
  return out;
}
function rollingStd(arr, win) {
  const out = new Array(arr.length).fill(null);
  let q = [];
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    q.push(v);
    if (q.length > win) q.shift();
    if (q.length === win && q.every(x => x != null)) {
      const m = q.reduce((a,b)=>a+b,0)/win;
      const s2 = q.reduce((a,b)=>a+(b-m)*(b-m),0)/win;
      out[i] = Math.sqrt(s2);
    } else out[i] = null;
  }
  return out;
}
function macd(close, f=12, s=26, sig=9) {
  const emaF = ema(close, f);
  const emaS = ema(close, s);
  const line = close.map((_,i)=> (emaF[i]==null||emaS[i]==null)?null:(emaF[i]-emaS[i]));
  const signal = ema(line.map(v => v==null?0:v), sig).map((v,i)=> line[i]==null?null:v);
  const hist = line.map((v,i)=> (v==null||signal[i]==null)?null:(v-signal[i]));
  return { line, signal, hist };
}
function rsi(close, p=14) {
  const out = new Array(close.length).fill(null);
  let avgU = null, avgD = null;
  for (let i=1;i<close.length;i++){
    const ch = (close[i]==null||close[i-1]==null)?null:(close[i]-close[i-1]);
    const u = ch>0 ? ch : 0;
    const d = ch<0 ? -ch : 0;
    if (i===p){ avgU = u; avgD = d; }
    if (i>p){
      avgU = (avgU*(p-1)+u)/p;
      avgD = (avgD*(p-1)+d)/p;
      const rs = avgD===0? 100 : (avgU/avgD);
      out[i] = 100 - 100/(1+rs);
    }
  }
  return out;
}
function highest(arr, n,i){ let m=-Infinity; for(let k=i-n+1;k<=i;k++){m=Math.max(m,arr[k]??-Infinity);} return m; }
function lowest(arr, n,i){ let m=Infinity;  for(let k=i-n+1;k<=i;k++){m=Math.min(m,arr[k]?? Infinity);} return m; }
function stochastic(h,l,c, kP=14, kS=3, dP=3){
  const kRaw = new Array(c.length).fill(null);
  for (let i=0;i<c.length;i++){
    if (i<kP-1 || h[i]==null||l[i]==null||c[i]==null){ kRaw[i]=null; continue; }
    const hh = highest(h, kP, i);
    const ll = lowest(l, kP, i);
    const denom = (hh-ll);
    kRaw[i] = denom===0? 50 : 100*( (c[i]-ll)/denom );
  }
  const k = sma(kRaw, kS);
  const d = sma(k, dP);
  return { k, d };
}
function stochRSI(close, p=14, k=3, d=3){
  const r = rsi(close, p);
  const sr = new Array(close.length).fill(null);
  for (let i=0;i<close.length;i++){
    if (i<p*2){ sr[i]=null; continue; }
    const seg = r.slice(i-p+1, i+1).filter(v=>v!=null);
    if (seg.length<p){ sr[i]=null; continue; }
    const lo = Math.min(...seg), hi = Math.max(...seg);
    sr[i] = (hi-lo)===0 ? 50 : 100*((r[i]-lo)/(hi-lo));
  }
  const kk = sma(sr, k);
  const dd = sma(kk, d);
  return { k: kk, d: dd };
}
function bollinger(close, win=20, mult=2){
  const m = sma(close, win);
  const s = rollingStd(close, win);
  const up = m.map((v,i)=> (v==null||s[i]==null)?null:(v+mult*s[i]));
  const lo = m.map((v,i)=> (v==null||s[i]==null)?null:(v-mult*s[i]));
  return { mid: m, up, lo };
}

// Trend-Levels (grob: lokale Extrema + Clustering)
function localExtremaIdx(arr, win=10){
  const lows=[], highs=[];
  for (let i=win;i<arr.length-win;i++){
    let lo=true, hi=true;
    for (let j=i-win;j<=i+win;j++){
      if (arr[j]==null){ lo=false; hi=false; break; }
      if (arr[j] < arr[i]) hi=false;
      if (arr[j] > arr[i]) lo=false;
      if (!lo && !hi) break;
    }
    if (lo) lows.push(i);
    if (hi) highs.push(i);
  }
  return { lows, highs };
}
function clusterLevels(prices, idxs, tolRel=0.01){
  const vals = idxs.map(i => prices[i]).filter(v=>v!=null).sort((a,b)=>a-b);
  const clusters=[];
  for (const v of vals){
    const last = clusters[clusters.length-1];
    if (!last || Math.abs(v - last[last.length-1]) > tolRel*last[last.length-1]) clusters.push([v]);
    else last.push(v);
  }
  return clusters.map(c=>{
    const m = c.reduce((a,b)=>a+b,0)/c.length;
    return { y0: Math.min(...c), y1: Math.max(...c), center: m, count: c.length };
  });
}

// -------------- React UI --------------
export default function ToolDashboard(){
  const [ticker, setTicker]   = useState('AAPL');
  const [period, setPeriod]   = useState('1y');
  const [interval, setInterval] = useState('1d');
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');
  const [payload, setPayload] = useState(null);

  async function load(){
    setLoading(true); setErr('');
    const t = ticker.trim().toUpperCase();
    const res = await fetchStock(t, period, interval);
    setLoading(false);
    if (!res.ok){ setErr('Keine Daten'); setPayload(null); return; }
    setPayload(res.data || null);
    if (!res.data) setErr('Keine Daten');
  }

  // Daten normalisieren
  const data = useMemo(()=> {
    if (!payload) return null;
    const xRaw = pickArr(payload,'index','dates','time','timestamp') || [];
    const x = toDates(xRaw);
    const open  = (pickArr(payload,'open','Open') || []).map(asNum);
    const high  = (pickArr(payload,'high','High') || []).map(asNum);
    const low   = (pickArr(payload,'low','Low')   || []).map(asNum);
    const close = (pickArr(payload,'close','Close')|| []).map(asNum);
    const vol   = (pickArr(payload,'volume','Volume')|| []).map(asNum);
    const n = Math.min(x.length, open.length, high.length, low.length, close.length);
    if (n < 20) return null;
    return {
      x: x.slice(-n), open: open.slice(-n), high: high.slice(-n),
      low: low.slice(-n), close: close.slice(-n), volume: vol.slice(-n),
      meta: payload.meta || {}
    };
  }, [payload]);

  const figs = useMemo(()=> {
    if (!data) return null;
    const { x, open, high, low, close } = data;

    const bb = bollinger(close, 20, 2);
    const ema9  = ema(close, 9);
    const ema21 = ema(close, 21);
    const ema50 = ema(close, 50);

    const m = macd(close);
    const r = rsi(close, 14);
    const st = stochastic(high, low, close, 14, 3, 3);
    const sr = stochRSI(close, 14, 3, 3);

    const ext = localExtremaIdx(close, 10);
    const clusters = clusterLevels(close, [...ext.lows, ...ext.highs], 0.01);

    return {
      price: {
        data: [
          { type:'candlestick', x, open, high, low, close, name:'OHLC',
            increasing:{line:{width:1}}, decreasing:{line:{width:1}} },
          { type:'scatter', mode:'lines', x, y: bb.up,   name:'BB upper', line:{width:1, dash:'dot'} },
          { type:'scatter', mode:'lines', x, y: bb.mid,  name:'BB mid',   line:{width:1, dash:'dot'} },
          { type:'scatter', mode:'lines', x, y: bb.lo,   name:'BB lower', line:{width:1, dash:'dot'} },
          { type:'scatter', mode:'lines', x, y: ema9,  name:'EMA 9',  line:{width:1}},
          { type:'scatter', mode:'lines', x, y: ema21, name:'EMA 21', line:{width:1}},
          { type:'scatter', mode:'lines', x, y: ema50, name:'EMA 50', line:{width:1}},
        ],
        layout: { height: 420, margin:{l:40,r:10,t:10,b:20}, showlegend:false, xaxis:{rangeslider:{visible:false}} }
      },
      macd: {
        data: [
          { type:'bar', x, y: m.hist, name:'Hist', opacity:0.5 },
          { type:'scatter', mode:'lines', x, y: m.line, name:'MACD' },
          { type:'scatter', mode:'lines', x, y: m.signal, name:'Signal' },
        ],
        layout: { height: 180, margin:{l:40,r:10,t:10,b:20}, showlegend:false, shapes:[{type:'line', xref:'paper', x0:0, x1:1, y0:0, y1:0, line:{dash:'dot'}}] }
      },
      rsi: {
        data: [{ type:'scatter', mode:'lines', x, y:r, name:'RSI(14)'}],
        layout: { height: 160, margin:{l:40,r:10,t:10,b:20}, showlegend:false,
          yaxis:{range:[0,100]}, shapes:[
            {type:'line', xref:'paper',x0:0,x1:1,y0:30,y1:30,line:{dash:'dot'}},
            {type:'line', xref:'paper',x0:0,x1:1,y0:70,y1:70,line:{dash:'dot'}}
          ] }
      },
      stoch: {
        data: [
          { type:'scatter', mode:'lines', x, y: st.k, name:'%K' },
          { type:'scatter', mode:'lines', x, y: st.d, name:'%D' },
        ],
        layout: { height: 160, margin:{l:40,r:10,t:10,b:20}, showlegend:false,
          yaxis:{range:[0,100]}, shapes:[
            {type:'line', xref:'paper',x0:0,x1:1,y0:20,y1:20,line:{dash:'dot'}},
            {type:'line', xref:'paper',x0:0,x1:1,y0:80,y1:80,line:{dash:'dot'}}
          ] }
      },
      stochrsi: {
        data: [
          { type:'scatter', mode:'lines', x, y: sr.k, name:'StochRSI %K' },
          { type:'scatter', mode:'lines', x, y: sr.d, name:'StochRSI %D' },
        ],
        layout: { height: 160, margin:{l:40,r:10,t:10,b:20}, showlegend:false,
          yaxis:{range:[0,100]}, shapes:[
            {type:'line', xref:'paper',x0:0,x1:1,y0:20,y1:20,line:{dash:'dot'}},
            {type:'line', xref:'paper',x0:0,x1:1,y0:80,y1:80,line:{dash:'dot'}}
          ] }
      },
      trend: {
        data: [
          { type:'scatter', mode:'lines', x, y: close, name:'Close', line:{width:1.4} },
          ...ext.lows.map(i => ({type:'scatter', mode:'markers', x:[x[i]], y:[close[i]], marker:{symbol:'triangle-down', size:12}, showlegend:false})),
          ...ext.highs.map(i => ({type:'scatter', mode:'markers', x:[x[i]], y:[close[i]], marker:{symbol:'triangle-up', size:12}, showlegend:false})),
        ],
        layout: { height: 220, margin:{l:40,r:10,t:10,b:25}, showlegend:false,
          shapes: clusters.map(c => ({type:'line', xref:'paper', x0:0, x1:1, y0:c.center, y1:c.center, opacity:0.6}))
        }
      }
    };
  }, [data]);

  const metaLine = data ? `Quelle: ${data.meta.source ?? '—'}  ·  Period verwendet: ${data.meta.used_period ?? period}  ·  Interval verwendet: ${data.meta.used_interval ?? interval}` : 'Quelle: —  ·  Period verwendet: —  ·  Interval verwendet: —';

  return (
    <div style={{padding:'16px 18px', color:'#ddd', fontFamily:'system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial'}}>
      <h1 style={{margin:'4px 0 14px'}}>Trading Dashboard</h1>
      <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
        <input value={ticker} onChange={e=>setTicker(e.target.value)} style={{width:120, padding:'6px 8px', borderRadius:6, border:'1px solid #444', background:'#111', color:'#eee'}}/>
        <select value={period} onChange={e=>setPeriod(e.target.value)} style={{padding:'6px 8px', borderRadius:6, background:'#111', color:'#eee', border:'1px solid #444'}}>
          {['1y','2y','3y','5y'].map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <select value={interval} onChange={e=>setInterval(e.target.value)} style={{padding:'6px 8px', borderRadius:6, background:'#111', color:'#eee', border:'1px solid #444'}}>
          {['1d','1h','1wk'].map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={load} disabled={loading} style={{padding:'6px 12px', borderRadius:6, background:'#2a66f0', color:'#fff', border:'none', cursor:'pointer'}}>{loading?'Lädt…':'Laden'}</button>
      </div>

      <div style={{marginTop:8, fontSize:12, color:'#9aa'}}>{metaLine}</div>
      {err && <div style={{marginTop:6, color:'#ff6'}}>Fehler: {err}</div>}

      {figs && (
        <>
          <Plot data={figs.price.data} layout={figs.price.layout} config={{responsive:true}} />
          <Plot data={figs.macd.data} layout={figs.macd.layout} config={{responsive:true}} />
          <Plot data={figs.rsi.data} layout={figs.rsi.layout} config={{responsive:true}} />
          <Plot data={figs.stoch.data} layout={figs.stoch.layout} config={{responsive:true}} />
          <Plot data={figs.stochrsi.data} layout={figs.stochrsi.layout} config={{responsive:true}} />
          <Plot data={figs.trend.data} layout={figs.trend.layout} config={{responsive:true}} />
        </>
      )}

      <details style={{marginTop:10}}>
        <summary style={{cursor:'pointer'}}>Debug: Rohdaten anzeigen</summary>
        <pre style={{whiteSpace:'pre-wrap', background:'#111', padding:12, borderRadius:8, border:'1px solid #333', color:'#9f9'}}>
{JSON.stringify(payload, null, 2)}
        </pre>
      </details>
    </div>
  );
}
