import React, { useMemo, useState } from 'react';
import Plot from 'react-plotly.js';
import { API_BASE } from '../config.js';

function ema(arr, span){
  const a = 2/(span+1);
  const out = new Array(arr.length).fill(null);
  let prev = null;
  for (let i=0;i<arr.length;i++){
    const v = arr[i];
    if (v==null) { out[i]=null; continue; }
    if (prev==null){ prev = v; out[i]=v; }
    else { prev = a*v + (1-a)*prev; out[i]=prev; }
  }
  return out;
}
function sma(arr, n){
  const out = new Array(arr.length).fill(null);
  let sum = 0, q=[];
  for (let i=0;i<arr.length;i++){
    const v = arr[i];
    if (v==null){ q=[]; sum=0; continue; }
    q.push(v); sum += v;
    if (q.length>n){ sum -= q.shift(); }
    if (q.length===n){ out[i]=sum/n; }
  }
  return out;
}
function stdev(arr, n){
  const out = new Array(arr.length).fill(null);
  let q=[];
  for (let i=0;i<arr.length;i++){
    const v = arr[i];
    if (v==null){ q=[]; continue; }
    q.push(v);
    if (q.length>n) q.shift();
    if (q.length===n){
      const m = q.reduce((a,b)=>a+b,0)/n;
      const s = Math.sqrt(q.reduce((a,b)=>a+(b-m)*(b-m),0)/n);
      out[i]=s;
    }
  }
  return out;
}
function macd(close, f=12, s=26, sig=9){
  const e1 = ema(close, f), e2 = ema(close, s);
  const macd = close.map((_,i)=> (e1[i]!=null && e2[i]!=null)? e1[i]-e2[i] : null);
  const signal = ema(macd.map(v=>v==null?null:v), sig);
  const hist = macd.map((v,i)=> (v!=null && signal[i]!=null)? v - signal[i] : null);
  return { macd, signal, hist };
}
function rsiWilder(close, p=14){
  const out = new Array(close.length).fill(null);
  let avgG=null, avgL=null;
  for (let i=1;i<close.length;i++){
    const ch = close[i]-close[i-1];
    const g = Math.max(0,ch);
    const l = Math.max(0,-ch);
    if (i===p){
      let sumG=0,sumL=0;
      for (let k=1;k<=p;k++){
        const d = close[k]-close[k-1];
        sumG += Math.max(0,d);
        sumL += Math.max(0,-d);
      }
      avgG = sumG/p; avgL = sumL/p;
      const rs = avgL===0 ? 100 : avgG/avgL;
      out[i] = 100 - (100/(1+rs));
    } else if (i>p){
      avgG = (avgG*(p-1)+g)/p;
      avgL = (avgL*(p-1)+l)/p;
      const rs = avgL===0 ? 100 : avgG/avgL;
      out[i] = 100 - (100/(1+rs));
    }
  }
  return out.map(v => v==null?null:Math.max(0,Math.min(100,v)));
}
function rollingHigh(arr,n){
  const out = new Array(arr.length).fill(null);
  let q=[];
  for (let i=0;i<arr.length;i++){
    const v = arr[i]; if (v==null){ q=[]; continue; }
    q.push(v); if (q.length>n) q.shift();
    if (q.length===n) out[i]=Math.max(...q);
  }
  return out;
}
function rollingLow(arr,n){
  const out = new Array(arr.length).fill(null);
  let q=[];
  for (let i=0;i<arr.length;i++){
    const v = arr[i]; if (v==null){ q=[]; continue; }
    q.push(v); if (q.length>n) q.shift();
    if (q.length===n) out[i]=Math.min(...q);
  }
  return out;
}
function stoch(high, low, close, kP=14, kSm=3, dP=3){
  const hh = rollingHigh(high, kP);
  const ll = rollingLow(low, kP);
  const raw = close.map((c,i)=>{
    if (c==null || hh[i]==null || ll[i]==null || hh[i]===ll[i]) return null;
    return 100*(c-ll[i])/(hh[i]-ll[i]);
  });
  const k = sma(raw, kSm);
  const d = sma(k, dP);
  return { k, d };
}
function stochRsi(close, p=14, kSm=3, dP=3){
  const r = rsiWilder(close,p);
  const hh = rollingHigh(r, p);
  const ll = rollingLow(r, p);
  const raw = r.map((v,i)=>{
    if (v==null || hh[i]==null || ll[i]==null || hh[i]===ll[i]) return null;
    return 100*(v-ll[i])/(hh[i]-ll[i]);
  });
  const k = sma(raw, kSm);
  const d = sma(k, dP);
  return { k, d };
}
function localExtrema(prices, win=10){
  const lows=[], highs=[];
  for (let i=win;i<prices.length-win;i++){
    const v = prices[i];
    let low=true, high=true;
    for (let j=i-win;j<=i+win;j++){
      if (prices[j]<v) high=false;
      if (prices[j]>v) low=false;
      if (!low && !high) break;
    }
    if (low) lows.push(i);
    if (high) highs.push(i);
  }
  return { lows, highs };
}
async function fetchStock(ticker, period, interval){
  const url = `${API_BASE}/api/stock?ticker=${encodeURIComponent(ticker)}&period=${encodeURIComponent(period)}&interval=${encodeURIComponent(interval)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  if (j.error) throw new Error(j.error);
  return j;
}

export default function ToolDashboard(){
  const [ticker, setTicker] = useState('AAPL');
  const [period, setPeriod] = useState('1y');
  const [interval, setInterval] = useState('1d');
  const [payload, setPayload] = useState(null);
  const [err, setErr] = useState('');

  const load = async () => {
    try{
      setErr('');
      const j = await fetchStock(ticker.trim(), period, interval);
      setPayload(j);
    }catch(e){ setErr(String(e.message||e)); }
  };

  const data = useMemo(()=>{
    if (!payload) return null;
    const x = (payload.index||[]).map(d=>d);
    const open = payload.open || [];
    const high = payload.high || [];
    const low  = payload.low || [];
    const close= payload.close|| [];

    const ema9 = ema(close,9);
    const ema21= ema(close,21);
    const ema50= ema(close,50);

    const bbBasis = sma(close,20);
    const bbStd   = stdev(close,20);
    const bbUp    = bbBasis.map((v,i)=> v==null||bbStd[i]==null?null:v+2*bbStd[i]);
    const bbLo    = bbBasis.map((v,i)=> v==null||bbStd[i]==null?null:v-2*bbStd[i]);

    const m = macd(close,12,26,9);
    const rsi = rsiWilder(close,14);
    const s = stoch(high,low,close,14,3,3);
    const sr = stochRsi(close,14,3,3);

    const ext = localExtrema(close,10);

    return { x, open, high, low, close, ema9, ema21, ema50, bbUp, bbLo, bbBasis, macd:m, rsi, stoch:s, stochRsi:sr, ext };
  },[payload]);

  const meta = payload?.meta || {};
  const cap = `Quelle: ${meta.source||'—'}  •  Period verwendet: ${meta.used_period||period}  •  Interval verwendet: ${meta.used_interval||interval}`;

  return (
    <div style={{padding:"20px 22px", color:"#eee", background:"#0d0f12", minHeight:"100vh"}}>
      <h1 style={{margin:"0 0 16px 0"}}>Trading Dashboard</h1>
      <div style={{display:"flex", gap:8, alignItems:"center", marginBottom:12}}>
        <input value={ticker} onChange={e=>setTicker(e.target.value)} style={{width:120, padding:"6px 8px"}}/>
        <select value={period} onChange={e=>setPeriod(e.target.value)}>
          {["1mo","3mo","6mo","1y","2y","5y","10y","max"].map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <select value={interval} onChange={e=>setInterval(e.target.value)}>
          {["1d","1wk","1mo","1h"].map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={load} style={{padding:"6px 12px"}}>Laden</button>
      </div>
      <div style={{marginBottom:10, color:"#bbb", fontSize:13}}>{cap}</div>
      {err && <div style={{color:"#ff6", margin:"10px 0"}}>Fehler: {err}</div>}
      {!data && <div style={{opacity:0.7}}>Klicke auf „Laden“.</div>}

      {data && (
        <>
          {/* 1) Candles + EMAs + Bollinger */}
          <Plot
            data={[
              {
                type:'candlestick',
                x:data.x, open:data.open, high:data.high, low:data.low, close:data.close,
                name:'OHLC'
              },
              { type:'scatter', mode:'lines', x:data.x, y:data.ema9,  name:'EMA 9'  },
              { type:'scatter', mode:'lines', x:data.x, y:data.ema21, name:'EMA 21' },
              { type:'scatter', mode:'lines', x:data.x, y:data.ema50, name:'EMA 50' },
              { type:'scatter', mode:'lines', x:data.x, y:data.bbUp,   name:'BB Upper', line:{dash:'dot'} },
              { type:'scatter', mode:'lines', x:data.x, y:data.bbLo,   name:'BB Lower', line:{dash:'dot'} },
              { type:'scatter', mode:'lines', x:data.x, y:data.bbBasis,name:'BB Basis', line:{dash:'dash'} },
            ]}
            layout={{title:`${ticker.toUpperCase()} • Candles`, paper_bgcolor:'#0d0f12', plot_bgcolor:'#0d0f12', font:{color:'#ddd'}, height:380, margin:{l:40,r:10,t:30,b:20}, xaxis:{rangeslider:{visible:false}}}}
            config={{displaylogo:false, responsive:true}}
          />

          {/* 2) MACD */}
          <Plot
            data={[
              { type:'bar', x:data.x, y:data.macd.hist, name:'Hist', opacity:0.5 },
              { type:'scatter', mode:'lines', x:data.x, y:data.macd.macd, name:'MACD' },
              { type:'scatter', mode:'lines', x:data.x, y:data.macd.signal, name:'Signal' },
            ]}
            layout={{title:'MACD', paper_bgcolor:'#0d0f12', plot_bgcolor:'#0d0f12', font:{color:'#ddd'}, height:220, margin:{l:40,r:10,t:30,b:20}, shapes:[{type:'line', xref:'paper', x0:0, x1:1, yref:'y', y0:0, y1:0, line:{dash:'dot'}}]}}
            config={{displaylogo:false, responsive:true}}
          />

          {/* 3) RSI */}
          <Plot
            data={[
              { type:'scatter', mode:'lines', x:data.x, y:data.rsi, name:'RSI(14)' },
            ]}
            layout={{title:'RSI', paper_bgcolor:'#0d0f12', plot_bgcolor:'#0d0f12', font:{color:'#ddd'}, height:220, margin:{l:40,r:10,t:30,b:20},
              yaxis:{range:[0,100]},
              shapes:[
                {type:'line', xref:'paper', x0:0, x1:1, yref:'y', y0:70, y1:70, line:{dash:'dot'}},
                {type:'line', xref:'paper', x0:0, x1:1, yref:'y', y0:50, y1:50, line:{dash:'dot'}},
                {type:'line', xref:'paper', x0:0, x1:1, yref:'y', y0:30, y1:30, line:{dash:'dot'}},
              ]}}
            config={{displaylogo:false, responsive:true}}
          />

          {/* 4) Stochastic */}
          <Plot
            data={[
              { type:'scatter', mode:'lines', x:data.x, y:data.stoch.k, name:'%K' },
              { type:'scatter', mode:'lines', x:data.x, y:data.stoch.d, name:'%D' },
            ]}
            layout={{title:'Stochastic', paper_bgcolor:'#0d0f12', plot_bgcolor:'#0d0f12', font:{color:'#ddd'}, height:220, margin:{l:40,r:10,t:30,b:20},
              yaxis:{range:[0,100]},
              shapes:[
                {type:'line', xref:'paper', x0:0, x1:1, yref:'y', y0:80, y1:80, line:{dash:'dot'}},
                {type:'line', xref:'paper', x0:0, x1:1, yref:'y', y0:50, y1:50, line:{dash:'dot'}},
                {type:'line', xref:'paper', x0:0, x1:1, yref:'y', y0:20, y1:20, line:{dash:'dot'}},
              ]}}
            config={{displaylogo:false, responsive:true}}
          />

          {/* 5) Stoch RSI */}
          <Plot
            data={[
              { type:'scatter', mode:'lines', x:data.x, y=data.stochRsi.k, name:'Stoch RSI %K' },
              { type:'scatter', mode:'lines', x=data.x, y=data.stochRsi.d, name:'Stoch RSI %D' },
            ]}
            layout={{title:'Stoch RSI', paper_bgcolor:'#0d0f12', plot_bgcolor:'#0d0f12', font:{color:'#ddd'}, height:220, margin:{l:40,r:10,t:30,b:20},
              yaxis:{range:[0,100]},
              shapes:[
                {type:'line', xref:'paper', x0:0, x1:1, yref:'y', y0:80, y1:80, line:{dash:'dot'}},
                {type:'line', xref:'paper', x0:0, x1:1, yref:'y', y0:50, y1:50, line:{dash:'dot'}},
                {type:'line', xref:'paper', x0:0, x1:1, yref:'y', y0:20, y1:20, line:{dash:'dot'}},
              ]}}
            config={{displaylogo:false, responsive:true}}
          />

          {/* 6) Trend-Panel */}
          <Plot
            data={[
              { type:'scatter', mode:'lines', x:data.x, y:data.close, name:'Close' },
              ...data.ext.lows.map(i=>({type:'scatter', mode:'markers', x:[data.x[i]], y:[data.close[i]], name:'Low', marker:{symbol:'triangle-down', size:10}})),
              ...data.ext.highs.map(i=>({type:'scatter', mode:'markers', x:[data.x[i]], y:[data.close[i]], name:'High', marker:{symbol:'triangle-up', size:10}})),
            ]}
            layout={{title:'Trend & Levels', paper_bgcolor:'#0d0f12', plot_bgcolor:'#0d0f12', font:{color:'#ddd'}, height:260, margin:{l:40,r:10,t:30,b:30}}}
            config={{displaylogo:false, responsive:true}}
          />

          <details style={{marginTop:12}}><summary style={{cursor:'pointer'}}>Debug: Rohdaten anzeigen</summary><pre style={{background:'#111', padding:'12px', borderRadius:'8px'}}>{JSON.stringify(payload,null,2)}</pre></details>
        </>
      )}
    </div>
  );
}
