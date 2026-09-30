import React,{useEffect,useMemo,useState} from "react";
import {createRoot} from "react-dom/client";
import "./styles.css";

type Tick={quote:number;digit:number;symbol:string;time:string};
const SYMBOLS=["R_10","R_25","R_50","R_75","R_100"];

function App(){
 const [tab,setTab]=useState<"live"|"backtest">("live");
 const [symbol,setSymbol]=useState("R_100");
 const [ticks,setTicks]=useState<Tick[]>([]);
 const [connected,setConnected]=useState(false);
 const [minScore,setMinScore]=useState(65);
 const [windowSize,setWindowSize]=useState(100);
 const [running,setRunning]=useState(false);
 const [bt,setBt]=useState<any>(null);

 useEffect(()=>{
   let ws:WebSocket|undefined;
   let retry:any;
   const connect=()=>{
     try{
       ws=new WebSocket((location.protocol==="https:"?"wss://":"ws://")+location.host+"/ws");
       ws.onopen=()=>setConnected(true);
       ws.onclose=()=>{setConnected(false); retry=setTimeout(connect,3000)};
       ws.onerror=()=>setConnected(false);
       ws.onmessage=e=>{
         try{
           const d=JSON.parse(e.data);
           if(d.type==="tick" && d.tick){
             setTicks(x=>[...x,{...d.tick}].slice(-1000));
           }
         }catch{}
       };
     }catch{setConnected(false)}
   };
   connect();
   return ()=>{clearTimeout(retry);ws?.close()};
 },[]);

 const filtered=useMemo(()=>ticks.filter(x=>x.symbol===symbol),[ticks,symbol]);
 const last=filtered.at(-1);
 const recent=filtered.slice(-windowSize);
 const counts=Array(10).fill(0);
 recent.forEach(x=>counts[x.digit]++);
 const total=recent.length;
 const even=recent.filter(x=>x.digit%2===0).length;
 const over=recent.filter(x=>x.digit>=5).length;
 let streak=0, streakDigit=last?.digit;
 if(last) for(let i=recent.length-1;i>=0&&recent[i].digit===streakDigit;i--) streak++;
 const candidates=counts.map((c,d)=>({digit:d,count:c,score:total?50+(c/total-.1)*180:50})).sort((a,b)=>b.score-a.score);

 async function runBacktest(){
   setRunning(true); setBt(null);
   const data=filtered.slice(-Math.min(filtered.length,1000));
   // Local fallback backtest so the mobile demo works even before a server is deployed.
   let wins=0,losses=0,totalScore=0;
   const start=Math.max(20,Math.floor(data.length*.3));
   for(let i=start;i<data.length-1;i++){
     const sample=data.slice(Math.max(0,i-windowSize),i);
     const c=Array(10).fill(0); sample.forEach(t=>c[t.digit]++);
     const pred=c.indexOf(Math.max(...c));
     const score=50+(c[pred]/Math.max(1,sample.length)-.1)*180;
     if(score>=minScore){ totalScore+=score; if(pred===data[i].digit) wins++; else losses++; }
   }
   const n=wins+losses;
   setBt({ticks:data.length,wins,losses,signals:n,winRate:n?(wins/n*100):0,avgScore:n?totalScore/n:0});
   setRunning(false);
 }

 return <div className="app">
   <header><div><div className="brand">PROFIT ANALYTICS PRO</div><div className="sub">Deriv digit analytics · research mode</div></div><span className={connected?"dot on":"dot"}></span></header>
   <nav><button className={tab==="live"?"active":""} onClick={()=>setTab("live")}>Live</button><button className={tab==="backtest"?"active":""} onClick={()=>setTab("backtest")}>Backtest</button></nav>

   {tab==="live" ? <main>
     <section className="controls"><label>Market<select value={symbol} onChange={e=>setSymbol(e.target.value)}>{SYMBOLS.map(s=><option key={s}>{s}</option>)}</select></label><label>Window<select value={windowSize} onChange={e=>setWindowSize(+e.target.value)}><option value="50">50</option><option value="100">100</option><option value="250">250</option></select></label></section>
     <section className="hero"><span>LAST DIGIT</span><strong>{last?.digit ?? "—"}</strong><small>{last ? last.quote : "Waiting for ticks…"}</small></section>
     <div className="grid">
       <Card title="Even"><b>{total?((even/total)*100).toFixed(1):"0"}%</b><small>{even}/{total}</small></Card>
       <Card title="Odd"><b>{total?(((total-even)/total)*100).toFixed(1):"0"}%</b><small>{total-even}/{total}</small></Card>
       <Card title="Over 4"><b>{total?((over/total)*100).toFixed(1):"0"}%</b><small>{over}/{total}</small></Card>
       <Card title="Under 5"><b>{total?(((total-over)/total)*100).toFixed(1):"0"}%</b><small>{total-over}/{total}</small></Card>
     </div>
     <section className="panel"><h2>Digit distribution</h2><div className="bars">{counts.map((c,d)=><div className="bar" key={d}><div className="fill" style={{height:`${total?Math.max(3,c/Math.max(...counts)*100):3}%`}}></div><span>{d}</span><small>{c}</small></div>)}</div></section>
     <section className="panel"><h2>Signal candidates</h2>{candidates.slice(0,3).map(c=><div className="candidate" key={c.digit}><span>Digit {c.digit}</span><strong>{Math.min(99,Math.max(1,c.score)).toFixed(0)}%</strong></div>)}</section>
     <section className="panel"><h2>Current streak</h2><div className="streak">{last?`Digit ${last.digit} × ${streak}`:"Waiting…"}</div></section>
   </main> :
   <main>
     <section className="panel"><h2>Backtest</h2><p className="muted">Runs a simple frequency-based research test against the ticks currently received by the dashboard.</p>
       <label>Minimum score <input type="range" min="50" max="90" value={minScore} onChange={e=>setMinScore(+e.target.value)}/><b>{minScore}</b></label>
       <label>Analysis window <select value={windowSize} onChange={e=>setWindowSize(+e.target.value)}><option value="50">50</option><option value="100">100</option><option value="250">250</option></select></label>
       <button className="run" disabled={running||filtered.length<25} onClick={runBacktest}>{running?"Running…":"Run backtest"}</button>
       {filtered.length<25&&<p className="warn">Receive at least 25 ticks before testing.</p>}
     </section>
     {bt&&<section className="grid">
       <Card title="Win rate"><b>{bt.winRate.toFixed(1)}%</b><small>{bt.wins} wins / {bt.losses} losses</small></Card>
       <Card title="Signals"><b>{bt.signals}</b><small>{bt.ticks} ticks tested</small></Card>
       <Card title="Avg score"><b>{bt.avgScore.toFixed(1)}</b><small>research score</small></Card>
       <Card title="Market"><b>{symbol}</b><small>current stream</small></Card>
     </section>}
     <section className="panel"><h2>Important</h2><p className="muted">This is an analytical backtest, not a simulator of Deriv contract settlement, and historical performance does not establish future results.</p></section>
   </main>}
   <footer>Connection: {connected?"LIVE":"OFFLINE"} · No trade execution · No payment system</footer>
 </div>
}
function Card({title,children}:{title:string,children:any}){return <div className="card"><span>{title}</span>{children}</div>}
createRoot(document.getElementById("root")!).render(<App/>);