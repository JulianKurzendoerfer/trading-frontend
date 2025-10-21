import React, { useMemo, useState } from 'react';
import Plot from 'react-plotly.js';
import { API_BASE } from '../config.js';

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function getJSONWithRetry(path){
  const url = `${API_BASE}${path}`;
  const tries = [0, 400, 900];
  let lastErr = null;
  for (let i=0; i<tries.length; i++){
    try{
      const res = await fetch(url, { cache:'no-store' });
      if (res.ok){
        return await res.json();
      } else if ([502,503,504].includes(res.status)){
        lastErr = new Error(`HTTP ${res.status}`);
      } else {
        const t = await res.text();
        throw new Error(`HTTP ${res.status}: ${t}`);
      }
    }catch(e){
      lastErr = e;
    }
    if (i < tries.length-1) await sleep(tries[i+1]);
  }
  throw lastErr || new Error('Backend not reachable');
}

function ema(arr, span){
  const a = 2/(span+1);
  const out = new Array(arr.length).fill(null);
  let prev = null;
  for (let i=0;i<arr.length;i++){
    const v = arr[i];
    if (v==null){ out[i]=prev; continue; }
    prev = (prev==null)? v : (a*v + (1-a)*prev);
    out[i]=prev;
  }
  return out;
}

function sma(arr, win){
  const out = new Array(arr.length).fill(null);
  let s=0, q=[];
  for (let i=0;i<arr.length;i++){
    const v=arr[i];
    q.push(v); s+=v;
    if (q.length>win){ s-=q.shift(); }
    if (q.length===win) out[i]=s/win;
  }
  return out;
}

function std(arr, win, mean){
  const out = new Array(arr.length).fill(null);
  let q=[];
  for (let i=0;i<arr.length;i++){
    const v=arr[i];
    q.push(v);
    if (q.length>win){ q.shift(); }
    if (q.length===win){
      const m = mean[i];
      let ss=0; for (let j=0;j<q.length;j++){ const d=q[j]-m; ss+=d*d; }
      out[i]=Math.sqrt(ss/q.length);
    }
  }
  return out;
}

function rsiWilder(close, period=14){
  const out = new Array(close.length).fill(null);
  let prev = null, avgGain=0, avgLoss=0, initG=0, initL=0, initN=0;
  for (let i=1;i<close.length;i++){
    const ch = close[i]-close[i-1];
    const g = Math.max(0,ch), l = Math.max(0,-ch);
    if (initN<period){ initG+=g; initL+=l; initN++; if (initN===period){ avgGain=initG/period; avgLoss=initL/period; } }
    else { avgGain = (avgGain*(period-1)+g)/period; avgLoss=(avgLoss*(period-1)+l)/period; }
    if (i>=period){
      const rs = avgLoss===0? 100 : avgGain/avgLoss;
      out[i] = 100 - (100/(1+rs));
    }
    prev = close[i];
  }
  return out;
}

function stoch(high, low, close, kPeriod=14, kSmooth=3, dPeriod=3){
  const n=close.length;
  const hh=new Array(n).fill(null), ll=new Array(n).fill(null), raw=new Array(n).fill(null);
  let qH=[], qL=[];
  for (let i=0;i<n;i++){
    const H=high[i], L=low[i], C=close[i];
    qH.push(H); qL.push(L);
    if (qH.length>kPeriod){ qH.shift(); qL.shift(); }
    if (qH.length===kPeriod){
      const hi=Math.max(...qH), lo=Math.min(...qL);
      raw[i] = (hi===lo)? 50 : ( (C-lo)/(hi-lo)*100 );
    }
  }
  const ks = sma(raw,kSmooth);
  const ds = sma(ks,dPeriod);
  return { k: ks, d: ds };
}

function macd(close, fast=12, slow=26, signal=9){
  const emaF=ema(close,fast), emaS=ema(close,slow);
  const m = close.map((_,i)=> emaF[i]!=null&&emaS[i]!=null? emaF[i]-emaS[i] : null);
  const s = ema(m, signal);
  const h = m.map((v,i)=> (v!=null&&s[i]!=null)? v-s[i] : null);
  return { m, s, h };
}

function toCandles(rows){
  const x=[], o=[], h=[], l=[], c=[];
  for (const r of rows){
    x.push(r.index); o.push(r.open); h.push(r.high); l.push(r.low); c.push(r.close);
  }
  return { x, o, h, l, c };
}

export default function ToolDashboard(){
  const [ticker, setTicker] = useState('AAPL');
  const [period, setPeriod] = useState('1y');
  const [interval, setInterval] = useState('1d');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [payload, setPayload] = useState(null);

  async function load(){
    setErr(''); setLoading(true); setPayload(null);
    try{
      const path = `/api/stock?ticker=${encodeURIComponent(ticker)}&period=${encodeURIComponent(period)}&interval=${encodeURIComponent(interval)}`;
      const p = await getJSONWithRetry(path);
      if (!p || p.ok===false || !p.data || !p.data.length){
        throw new Error(p && p.error ? p.error : 'Keine Daten');
      }
      setPayload(p);
    }catch(e){
      setErr(e.message || String(e));
    }finally{
      setLoading(false);
    }
  }

  const fig = useMemo(()=>{
    if (!payload || !payload.data || !payload.data.length) return null;
    const rows = payload.data;
    const candles = toCandles(rows);
    const close = candles.c.map(v=> (v==null? null: +v));
    const high  = candles.h.map(v=> (v==null? null: +v));
    const low   = candles.l.map(v=> (v==null? null: +v));

    const ema9  = ema(close,9);
    const ema21 = ema(close,21);
    const ema50 = ema(close,50);

    const bbMid = sma(close,20);
    const bbStd = std(close,20,bbMid);
    const bbUp  = bbMid.map((v,i)=> (v!=null&&bbStd[i]!=null)? v+2*bbStd[i]:null);
    const bbLo  = bbMid.map((v,i)=> (v!=null&&bbStd[i]!=null)? v-2*bbStd[i]:null);

    const mac = macd(close,12,26,9);
    const rsi = rsiWilder(close,14);
    const st  = stoch(high,low,close,14,3,3);
    const stR = stoch(rsi,rsi,rsi,14,3,3);

    const traces = [
      {type:'candlestick', x:candles.x, open:candles.o, high:candles.h, low:candles.l, close:candles.c, name:'OHLC'},
      {type:'scatter', mode:'lines', x:candles.x, y:bbUp, name:'BB Upper', line:{width:1}},
      {type:'scatter', mode:'lines', x:candles.x, y:bbMid, name:'BB Basis', line:{width:1, dash:'dot'}},
      {type:'scatter', mode:'lines', x:candles.x, y:bbLo, name:'BB Lower', line:{width:1}},
      {type:'scatter', mode:'lines', x:candles.x, y:ema9,  name:'EMA 9', line:{width:1}},
      {type:'scatter', mode:'lines', x:candles.x, y:ema21, name:'EMA 21', line:{width:1}},
      {type:'scatter', mode:'lines', x:candles.x, y:ema50, name:'EMA 50', line:{width:1}},
      {type:'bar',     x:candles.x, y:mac.h, name:'MACD Hist', xaxis:'x2', yaxis:'y2', opacity:0.5},
      {type:'scatter', mode:'lines', x:candles.x, y:mac.m, name:'MACD',     xaxis:'x2', yaxis:'y2'},
      {type:'scatter', mode:'lines', x:candles.x, y:mac.s, name:'Signal',   xaxis:'x2', yaxis:'y2'},
      {type:'scatter', mode:'lines', x:candles.x, y:rsi,   name:'RSI(14)',  xaxis:'x3', yaxis:'y3'},
      {type:'scatter', mode:'lines', x:candles.x, y:st.k,  name:'Stoch %K', xaxis:'x4', yaxis:'y4'},
      {type:'scatter', mode:'lines', x:candles.x, y:st.d,  name:'Stoch %D', xaxis:'x4', yaxis:'y4'},
      {type:'scatter', mode:'lines', x:candles.x, y:stR.k, name:'StochRSI %K', xaxis:'x5', yaxis:'y5'},
      {type:'scatter', mode:'lines', x:candles.x, y:stR.d, name:'StochRSI %D', xaxis:'x5', yaxis:'y5'}
    ];

    const layout = {
      template:'plotly_dark',
      height:900,
      margin:{l:40,r:10,t:30,b:20},
      showlegend:false,
      grid:{rows:5, columns:1, pattern:'independent', roworder:'top to bottom'},
      xaxis:  {domain:[0,1]},
      yaxis:  {domain:[0.60,1], fixedrange:false},
      xaxis2: {anchor:'y2'},
      yaxis2: {domain:[0.45,0.59]},
      xaxis3: {anchor:'y3'},
      yaxis3: {domain:[0.30,0.44], range:[0,100]},
      xaxis4: {anchor:'y4'},
      yaxis4: {domain:[0.15,0.29], range:[0,100]},
      xaxis5: {anchor:'y5'},
      yaxis5: {domain:[0.00,0.14], range:[0,100]}
    };
    return { layout, data: traces };
  }, [payload]);

  return (
    <div style={{padding:'16px', color:'#eee', fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, Arial'}}>
      <h1 style={{margin:'0 0 12px'}}>Trading Dashboard</h1>
      <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:10}}>
        <input value={ticker} onChange={e=>setTicker(e.target.value)} style={{width:120}}/>
        <select value={period} onChange={e=>setPeriod(e.target.value)}>
          {['1mo','3mo','6mo','1y','2y','5y','10y'].map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <select value={interval} onChange={e=>setInterval(e.target.value)}>
          {['1d','1h','1wk','1mo'].map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={load} disabled={loading}>{loading?'Lädt…':'Laden'}</button>
      </div>

      <div style={{marginBottom:8, color:'#bbb', fontSize:12}}>
        Quelle: — • Period verwendet: <b>{payload?.used_period || '—'}</b> • Interval verwendet: <b>{payload?.used_interval || '—'}</b>
      </div>
      {err && <div style={{color:'#ff6', margin:'8px 0'}}>Fehler: {err}</div>}
      {fig && <Plot data={fig.data} layout={fig.layout} config={{displayModeBar:true, responsive:true}} />}

      <details style={{marginTop:12}}>
        <summary style={{cursor:'pointer'}}>Debug: Rohdaten anzeigen</summary>
        <pre style={{marginTop:8, background:'#111', padding:'12px', overflow:'auto'}}>
{JSON.stringify(payload, null, 2)}
        </pre>
      </details>
    </div>
  );
}
