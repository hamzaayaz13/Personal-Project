// Record a DC artboard's real animation, slowed so every frame is caught.
// usage: node rec.js plan.json outdir
const {chromium}=require('playwright');const fs=require('fs');
const RATE=0.1;
(async()=>{
 const plan=JSON.parse(fs.readFileSync(process.argv[2]));const out=process.argv[3];fs.mkdirSync(out,{recursive:true});
 const br=await chromium.launch();
 const ctx=await br.newContext({viewport:{width:430,height:932},deviceScaleFactor:2});
 await ctx.addInitScript(`(()=>{const R=${1/RATE};const st=window.setTimeout.bind(window);window.setTimeout=(f,d,...a)=>st(f,(d||0)*R,...a);})()`);
 const p=await ctx.newPage();
 await p.goto('http://127.0.0.1:8765/'+plan.file,{waitUntil:'networkidle'});
 await p.waitForTimeout(plan.settle??300);
 const cdp=await ctx.newCDPSession(p);await cdp.send('Animation.enable');
 // restart the page's entry animations under slow playback if asked
 await cdp.send('Animation.setPlaybackRate',{playbackRate:RATE});
 if(plan.reload){await p.reload({waitUntil:'networkidle'});await cdp.send('Animation.enable');await cdp.send('Animation.setPlaybackRate',{playbackRate:RATE});}
 const acts=(plan.actions||[]).map(a=>({...a,done:false}));const boxes={};
 for(const a of acts){const l=p.locator(a.sel,a.text?{hasText:a.text}:{}).nth(a.nth||0);const b=await l.boundingBox().catch(()=>null);if(b)boxes[a.id||a.t]={x:b.x,y:b.y,w:b.width,h:b.height};}
 const T=plan.ms;const t0=Date.now();const stamps=[];let i=0;
 while(true){
  const at=(Date.now()-t0)*RATE; if(at>T)break;
  for(const a of acts){ if(!a.done&&at>=a.t){a.done=true;const l=p.locator(a.sel,a.text?{hasText:a.text}:{}).nth(a.nth||0);const b=await l.boundingBox();boxes[a.id||a.t]=b?{x:b.x,y:b.y,w:b.width,h:b.height}:null;if(!a.noclick)await l.click({noWaitAfter:true,force:true});} }
  const ts=(Date.now()-t0)*RATE;await p.screenshot({path:`${out}/f${String(i).padStart(5,'0')}.png`});stamps.push(ts);i++;
 }
 fs.writeFileSync(out+'/stamps.json',JSON.stringify({stamps,boxes}));await br.close();
})();
