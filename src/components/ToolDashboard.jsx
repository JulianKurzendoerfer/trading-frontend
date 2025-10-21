import React, { useMemo, useState } from 'react';
import Plot from 'react-plotly.js';
import { API_BASE } from '../config.js';

function ema(arr, span) {
  const a = 2 / (span + 1);
  const out = new Array(arr.length).fill(null);
  let prev = null;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (v == null) { out[i] = prev; continue; }
    prev = (prev == null) ? v : (a * v + (1 - a) * prev);
    out[i] = prev;
  }
  return out;
}

function sma(arr, win) {
  const out = new Array(arr.length).fill(null);
  let sum = 0, q = [];
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    q.push(v); sum += v;
    if (q.length > win) sum -= q.shift();
    out[i] = (q.length === win) ? sum / win : null;
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
    if (q.length === win) {
      const m = q.reduce((a,b)=>a+b,0)/win;
      const s2 = q.reduce((a,b)=>a+(b-m)*(b-m),0)/win;
      out[i] = Math.sqrt(s2);
    }
  }
  return out;
}

function rsiWilder(close, period=14) {
  const out = new Array(close.length).fill(null);
  let avgGain = 0, avgLoss = 0, started = false;
  for (let i=1;i<close.length;i++){
    const ch = close[i] - close[i-1];
    const gain = Math.max(ch, 0);
    const loss = Math.max(-ch, 0);
    if (i <= period) {
      avgGain += gain; avgLoss += loss;
      if (i === period) {
        avgGain /= period; avgLoss /= period; started = true;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        out[i] = 100 - 100 / (1 + rs);
      }
    } else {
      avgGain = (avgGain*(period-1) + gain) / period;
      avgLoss = (avgLoss*(period-1) + loss) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      out[i] = 100 - 100 / (1 + rs);
    }
  }
  return out;
}

function macd(close, fast=12, slow=26, signal=9) {
  const emaFast = ema(close, fast);
  const emaSlow = ema(close, slow);
  const line = close.map((_,i)=>{
    const f = emaFast[i], s = emaSlow[i];
    return (f==null || s==null)? null : (f - s);
  });
  const sig = ema(line.map(v=>v??null), signal);
  const hist = line.map((v,i)=>(v==null||sig[i]==null)?null:(v - sig[i]));
  return { line, sig, hist };
}

function rollingMin(arr, win) {
  const out = new Array(arr.length).fill(null);
  for (let i=0;i<arr.length;i++){
    if (i+1<win) continue;
    let m = Infinity;
    for (let j=i-win+1;j<=i;j++) m = Math.min(m, arr[j]);
    out[i] = m;
  }
  return out;
}
function rollingMax(arr, win) {
  const out = new Array(arr.length).fill(null);
  for (let i=0;i<arr.length;i++){
    if (i+1<win) continue;
    let m = -Infinity;
    for (let j=i-win+1;j<=i;j++) m = Math.max(m, arr[j]);
    out[i] = m;
  }
  return out;
}

function stochastic(high, low, close, k=14, ks=3, d=3) {
  const hh = rollingMax(high, k);
  const ll = rollingMin(low, k);
  const rawK = close.map((c,i)=>{
    const H = hh[i], L = ll[i];
    if (H==null || L==null || H===L) return null;
    return 100 * (c - L) / (H - L);
  });
  const smooth = (a, w)=> {
    const out = new Array(a.length).fill(null);
    let q = [];
    for (let i=0;i<a.length;i++){
      const v = a[i]; if (v==null){ q=[]; continue; }
      q.push(v); if (q.length>w) q.shift();
      out[i] = (q.length===w) ? q.reduce((x,y)=>x+y,0)/w : null;
    }
    return out;
  };
  const kSlow = smooth(rawK, ks);
  const dSlow = smooth(kSlow, d);
  return { k: kSlow, d: dSlow };
}

function stochRsi(close, period=14, ks=3, ds=3) {
  const r = rsiWilder(close, period);
  const rrMin = rollingMin(r.map(v=>v??NaN), period);
  const rrMax = rollingMax(r.map(v=>v??NaN), period);
  const base = r.map((v,i)=>{
    const mn = rrMin[i], mx = rrMax[i];
    if (v==null || mn==null || mx==null || mx===mn) return null;
    return 100 * (v - mn) / (mx - mn);
  });
  const smooth = (a,w)=>{
    const out = new Array(a.length).fill(null);
    let q=[];
    for (let i=0;i<a.length;i++){
      const v=a[i]; if (v==null){ q=[]; continue; }
      q.push(v); if (q.length>w) q.shift();
      out[i] = (q.length===w)? q.reduce((x,y)=>x+y,0)/w : null;
    }
    return out;
  };
  const k = smooth(base, ks);
  const d = smooth(k, ds);
  return { k, d };
}

function localExtremaIdx(arr, win=8) {
  const lows=[], highs=[];
  for (let i=win;i<arr.length-win;i++){
    const v=arr[i];
    let low=true, high=true;
    for (let j=i-win;j<=i+win;j++){
      if (arr[j] < v) high=false;
      if (arr[j] > v) low =false;
      if (!low && !high) break;
    }
    if (low) lows.push(i);
    if (high) highs.push(i);
  }
  return { lows, highs };
}

function clusterLevels(prices, idxs, tolRel=0.01) {
  const vals = idxs.map(i=>prices[i]).sort((a,b)=>a-b);
  const clusters=[];
  for (const v of vals){
    if (!clusters.length) { clusters.push([v]); continue; }
    const last = clusters[clusters.length-1];
    if (Math.abs(v - last[last.length-1]) <= tolRel*last[last.length-1]) last.push(v);
    else clusters.push([v]);
  }
  return clusters.map(c=>{
    const mean = c.reduce((a,b)=>a+b,0)/c.length;
    return { y0: Math.min(...c), y1: Math.max(...c), center: mean, count: c.length };
  });
}

async function fetchStock(ticker, period, interval) {
  const qs = new URLSearchParams({ ticker });
  if (period) qs.set('period', period);
  if (interval) qs.set('interval', interval);
  const url = `${API_BASE}/api/stock?${qs.toString()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function ToolDashboard() {
  const [ticker, setTicker] = useState('AAPL');
  const [period, setPeriod] = useState('1y');
  const [interval, setInterval] = useState('1d');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [payload, setPayload] = useState(null);

  async function load() {
    try {
      setErr(''); setLoading(true);
      const p = await fetchStock(ticker.trim(), period, interval);
      if (!p || !p.index || !p.close) throw new Error('Keine Daten');
      setPayload(p);
    } catch (e) {
      setErr(String(e.message||e));
      setPayload(null);
    } finally { setLoading(false); }
  }

  const fig = useMemo(()=>{
    if (!payload) return null;
    const x = payload.index;
    const open = payload.open, high = payload.high, low = payload.low, close = payload.close;

    // Overlays
    const ema9  = ema(close, 9);
    const ema21 = ema(close, 21);
    const ema50 = ema(close, 50);
    const bbMid = sma(close, 20);
    const bbStd = rollingStd(close, 20);
    const bbUp  = bbMid.map((m,i)=>(m==null||bbStd[i]==null)?null:m+2*bbStd[i]);
    const bbLo  = bbMid.map((m,i)=>(m==null||bbStd[i]==null)?null:m-2*bbStd[i]);

    // MACD
    const mac = macd(close,12,26,9);

    // RSI
    const rsi = rsiWilder(close, 14);

    // Stoch
    const st = stochastic(high, low, close, 14, 3, 3);

    // Stoch RSI
    const sr = stochRsi(close, 14, 3, 3);

    // Trend Levels
    const { lows, highs } = localExtremaIdx(close, 8);
    const clusters = clusterLevels(close, lows.concat(highs), 0.01);

    const main = [
      {type:'candlestick', x, open, high, low, close, name:'OHLC', increasing:{line:{color:'#26a69a'}}, decreasing:{line:{color:'#ef5350'}}},
      {type:'scatter', mode:'lines', x, y: bbUp,  name:'BB Upper', line:{width:1, dash:'dot', color:'#ff7f7f'}},
      {type:'scatter', mode:'lines', x, y: bbMid, name:'BB Basis', line:{width:1, dash:'dot', color:'#b299ff'}},
      {type:'scatter', mode:'lines', x, y: bbLo,  name:'BB Lower', line:{width:1, dash:'dot', color:'#7fff7f'}},
      {type:'scatter', mode:'lines', x, y: ema9,  name:'EMA 9',   line:{width:1}},
      {type:'scatter', mode:'lines', x, y: ema21, name:'EMA 21',  line:{width:1}},
      {type:'scatter', mode:'lines', x, y: ema50, name:'EMA 50',  line:{width:1}},
    ];

    const macdData = [
      {type:'bar', x, y: mac.hist, name:'Hist', opacity:0.5},
      {type:'scatter', mode:'lines', x, y: mac.line, name:'MACD'},
      {type:'scatter', mode:'lines', x, y: mac.sig,  name:'Signal'}
    ];

    const rsiData = [
      {type:'scatter', mode:'lines', x, y: rsi, name:'RSI'}
    ];

    const stochData = [
      {type:'scatter', mode:'lines', x, y: st.k, name:'%K'},
      {type:'scatter', mode:'lines', x, y: st.d, name:'%D'},
    ];

    const stochRsiData = [
      {type:'scatter', mode:'lines', x, y: sr.k, name:'Stoch RSI %K'},
      {type:'scatter', mode:'lines', x, y: sr.d, name:'Stoch RSI %D'},
    ];

    const trendShapes = clusters.map(c=>({
      type:'line', xref:'paper', x0:0, x1:1, y0:c.center, y1:c.center,
      line:{width:1.5 + Math.min(c.count,4)*0.5, color:'rgba(130,170,255,0.85)'}
    }));

    return {
      x, close, main, macdData, rsiData, stochData, stochRsiData,
      trendShapes, lows, highs,
    };
  }, [payload]);

  return (
    <div style={{padding:'20px', color:'#eee'}}>
      <h1 style={{margin:'0 0 16px'}}>Trading Dashboard</h1>
      <div style={{display:'flex', gap:8, marginBottom:14}}>
        <input value={ticker} onChange={e=>setTicker(e.target.value)} style={{width:120}} />
        <select value={period} onChange={e=>setPeriod(e.target.value)}>
          {['1y','2y','3y','5y','1mo','3mo','6mo','1d'].map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <select value={interval} onChange={e=>setInterval(e.target.value)}>
          {['1d','1h','1wk'].map(i=><option key={i} value={i}>{i}</option>)}
        </select>
        <button onClick={load} disabled={loading} style={{padding:'6px 12px'}}>Laden</button>
      </div>

      <div style={{marginBottom:8, fontSize:13}}>
        Quelle: {payload?.meta?.source ?? '—'} · Period verwendet: {payload?.meta?.used_period ?? '—'} · Interval verwendet: {payload?.meta?.used_interval ?? '—'}
      </div>

      {err && <div style={{color:'#ff6'}}>Fehler: {err}</div>}

      {fig && (
        <>
          {/* Box 1: Candles + Bollinger + compact EMAs */}
          <Plot
            data={fig.main}
            layout={{template:'plotly_dark', height:420, margin:{l:40,r:10,t:10,b:30}, showlegend:false}}
            config={{displayModeBar:false, responsive:true}}
            style={{width:'100%'}}
          />

          {/* Box 2: MACD */}
          <Plot
            data={fig.macdData}
            layout={{
              template:'plotly_dark', height:160, margin:{l:40,r:10,t:10,b:30}, showlegend:false,
              shapes:[{type:'line', xref:'paper', x0:0, x1:1, y0:0, y1:0, line:{dash:'dot', color:'#999'}}]
            }}
            config={{displayModeBar:false, responsive:true}}
            style={{width:'100%', marginTop:10}}
          />

          {/* Box 3: RSI */}
          <Plot
            data={fig.rsiData}
            layout={{
              template:'plotly_dark', height:140, margin:{l:40,r:10,t:10,b:30}, showlegend:false,
              yaxis:{range:[0,100]}, shapes:[
                {type:'line', xref:'paper', x0:0, x1:1, y0:70, y1:70, line:{dash:'dot', color:'#aaa'}},
                {type:'line', xref:'paper', x0:0, x1:1, y0:50, y1:50, line:{dash:'dot', color:'#777'}},
                {type:'line', xref:'paper', x0:0, x1:1, y0:30, y1:30, line:{dash:'dot', color:'#aaa'}},
              ]
            }}
            config={{displayModeBar:false, responsive:true}}
            style={{width:'100%', marginTop:10}}
          />

          {/* Box 4: Stochastic */}
          <Plot
            data={fig.stochData}
            layout={{
              template:'plotly_dark', height:140, margin:{l:40,r:10,t:10,b:30}, showlegend:false,
              yaxis:{range:[0,100]}, shapes:[
                {type:'line', xref:'paper', x0:0, x1:1, y0:80, y1:80, line:{dash:'dot', color:'#aaa'}},
                {type:'line', xref:'paper', x0:0, x1:1, y0:50, y1:50, line:{dash:'dot', color:'#777'}},
                {type:'line', xref:'paper', x0:0, x1:1, y0:20, y1:20, line:{dash:'dot', color:'#aaa'}},
              ]
            }}
            config={{displayModeBar:false, responsive:true}}
            style={{width:'100%', marginTop:10}}
          />

          {/* Box 5: Stoch RSI */}
          <Plot
            data={fig.stochRsiData}
            layout={{
              template:'plotly_dark', height:140, margin:{l:40,r:10,t:10,b:30}, showlegend:false,
              yaxis:{range:[0,100]}, shapes:[
                {type:'line', xref:'paper', x0:0, x1:1, y0:80, y1:80, line:{dash:'dot', color:'#aaa'}},
                {type:'line', xref:'paper', x0:0, x1:1, y0:50, y1:50, line:{dash:'dot', color:'#777'}},
                {type:'line', xref:'paper', x0:0, x1:1, y0:20, y1:20, line:{dash:'dot', color:'#aaa'}},
              ]
            }}
            config={{displayModeBar:false, responsive:true}}
            style={{width:'100%', marginTop:10}}
          />

          {/* Box 6: Trend-Panel (Levels + markierte Extrema) */}
          <Plot
            data={[
              {type:'scatter', mode:'lines', x:payload.index, y:payload.close, name:'Close', line:{width:1.6}},
              {type:'scatter', mode:'markers', x:fig.lows.map(i=>payload.index[i]), y:fig.lows.map(i=>payload.close[i]),
               name:'Lows', marker:{symbol:'triangle-down', size:10, color:'lime', line:{color:'#111', width:1.5}}},
              {type:'scatter', mode:'markers', x:fig.highs.map(i=>payload.index[i]), y:fig.highs.map(i=>payload.close[i]),
               name:'Highs', marker:{symbol:'triangle-up', size:10, color:'red', line:{color:'#111', width:1.5}}}
            ]}
            layout={{template:'plotly_dark', height:220, margin:{l:40,r:10,t:10,b:30}, showlegend:false, shapes: fig.trendShapes}}
            config={{displayModeBar:false, responsive:true}}
            style={{width:'100%', marginTop:12}}
          />
        </>
      )}

      <details style={{marginTop:12}}>
        <summary style={{cursor:'pointer'}}>Debug: Rohdaten anzeigen</summary>
        <pre style={{marginTop:10, background:'#111', padding:'12px', borderRadius:8}}>
{JSON.stringify(payload, null, 2)}
        </pre>
      </details>
    </div>
  );
}
