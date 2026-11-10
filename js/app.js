window.Daybook=window.Daybook||{version:"0.1.0",plugins:[],registerPlugin(p){this.plugins.push(p)}};
(function(){
"use strict";
/* ---------- config ---------- */
const VERSION="0.1.0";
const STUDY_TYPES=["Homework","Practice","Vocabulary","Reading","Listening","Speaking","Exam"];
const APP_STATUSES=["Applied","Recruiter Screening","Interview","Offer","Rejected","On Hold"];
const FOLLOW_MIN=10, FOLLOW_MAX=21;
const LIVE_ST=["Recruiter Screening","Recruiter Screen Scheduled","Interview","Offer"];
const TASK_TYPES=["Task","Deadline","Review","Personal"];
const IV_RE=/interview|screen|recruit|hiring|intake|introduct|intro call/i;
const APPLY_GOAL=()=>Number(S.ui.applyGoal)||2;

/* ---------- customization (tiles, accent, density) ---------- */
const BUILTIN=["day","next","focus","job","learn","habits","att"];
const BNAMES={day:"Your day",next:"Next up",focus:"Focus",job:"Job search",learn:"Learning",habits:"Habits",att:"Needs attention"};
const ACCENTS={blue:["#2f4fc4","#e8ecfa","#8ea4ff","#252b45"],teal:["#0f766e","#dff3f0","#5fd3c4","#173a36"],violet:["#6247c9","#efeafc","#b3a0ff","#2e2650"],rose:["#be3f6c","#fbe8f1","#f08cb8","#3a2232"],orange:["#b4561c","#fdeee3","#f0a36b","#3b2a1d"],green:["#2f7d4a","#e6f4ea","#6cc58a","#1f3326"]};
function defUI(){return {order:BUILTIN.slice(),hidden:[],names:{},custom:[],accent:"blue",density:"cozy",addTo:"local",plugins:{},habits:[],modules:{job:false,learn:false},applyGoal:2,mascot:{on:true,colour:"status"}}}
function mergeUI(u){const d=defUI();if(!u||typeof u!=="object")return d;const o=Object.assign(d,u);o.plugins=u.plugins&&typeof u.plugins==='object'?u.plugins:{};o.habits=Array.isArray(u.habits)?u.habits:[];o.modules=Object.assign({job:false,learn:false},u.modules||{});o.mascot=Object.assign({on:true,colour:"status"},u.mascot||{});o.names=u.names&&typeof u.names==="object"?u.names:{};o.custom=Array.isArray(u.custom)?u.custom:[];o.hidden=Array.isArray(u.hidden)?u.hidden:[];o.order=Array.isArray(u.order)?u.order:d.order;return o}
function loadUI(){try{return mergeUI(JSON.parse(localStorage.getItem("daybook_ui")||"null"))}catch(_){return defUI()}}
const tn=(id,def)=>(S.ui&&S.ui.names&&S.ui.names[id])||def;
function applyUI(){
  const a=ACCENTS[S.ui.accent]||ACCENTS.blue;
  let el=document.getElementById("accentStyle");if(!el){el=document.createElement("style");el.id="accentStyle";document.head.appendChild(el)}
  const D="--accent:"+a[2]+";--accent-soft:"+a[3]+";--accent-ink:#121218";
  el.textContent=":root{--accent:"+a[0]+";--accent-soft:"+a[1]+";--accent-ink:#ffffff}@media (prefers-color-scheme:dark){:root:not([data-theme=\"light\"]){"+D+"}}:root[data-theme=\"dark\"]{"+D+"}";
  document.documentElement.setAttribute("data-density",S.ui.density==="compact"?"compact":"cozy");
  try{let ic=document.querySelector("link[rel=icon]");if(!ic){ic=document.createElement("link");ic.rel="icon";document.head.appendChild(ic)}ic.href="data:image/svg+xml,"+encodeURIComponent(logoSVG(64))}catch(_){}
}
function tileOrder(){const ids=BUILTIN.concat(S.ui.custom.map(c=>c.id));const o=S.ui.order.filter(i=>ids.includes(i));ids.forEach(i=>{if(!o.includes(i))o.push(i)});return o}

/* ---------- state ---------- */
const S={view:"home",db:null,
  sched:[],nsched:[],plugTasks:{},plugEvents:{},localEvents:[],ui:loadUI(),editHome:false,firstRun:false,
  ivs:[],gcal:[],apps:[],habits:{},hLoaded:false,study:[],courses:[],dBusy:false,
  schedSt:"ok",ivSt:"ok",gSt:"ok",aSt:"ok",dSt:"ok",errs:{},
  pomos:[],autodone:{},rowInfo:{},day:null,recur:[],recurDone:{},pending:{},addArea:"job",addWhen:"today",
  timer:loadTimer(),settings:loadSettings(),theme:loadTheme()};

/* ---------- dates ---------- */
const pad=n=>String(n).padStart(2,"0");
const toISO=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const today=()=>toISO(new Date());
const parse=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)};
const addDays=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return toISO(d)};
const daysBetween=(a,b)=>Math.round((parse(b)-parse(a))/86400000);
const hm=d=>pad(d.getHours())+":"+pad(d.getMinutes());
const fmtDay=s=>parse(s).toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"});
const fmtShort=s=>parse(s).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"});
const dow=s=>parse(s).toLocaleDateString("en-GB",{weekday:"short"});
function relDay(s){const t=today();if(s===t)return "today";if(s===addDays(t,1))return "tomorrow";if(s===addDays(t,-1))return "yesterday";return fmtShort(s)}

/* ---------- utils ---------- */
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pageId=u=>{const m=String(u||"").match(/([0-9a-f]{32})(?:\?|$)/i);return m?m[1]:""};
let toastT,toastFn=null;function toast(m,label,fn){const t=$("#toast");t.innerHTML="<span>"+esc(m)+"</span>"+(label?'<button type="button" id="toastBtn">'+esc(label)+"</button>":"");toastFn=fn||null;t.classList.add("on");clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove("on"),label?6000:2800)}
function payloadOf(r){let p=r&&r.payload;if(typeof p==="string"){try{p=JSON.parse(p)}catch(_){p=null}}return p}
function isQuota(e){return !!e&&(e.code==="rate_limited"||/exhaust|quota|rate.?limit|429|too many/i.test(String(e.message||"")))}
function errText(e,src){
  const c=e&&e.code;
  if(c==="needs_reauth")return src+" needs to be reconnected in Settings, Connectors.";
  if(c==="server_not_connected")return src+" isn't connected. Add it in Settings, Connectors.";
  if(c==="not_in_manifest"||c==="not_granted")return src+" access is off for this page. Allow it from the page's permissions.";
  if(c==="server_unavailable")return src+" didn't answer. Try Refresh in a moment.";
  if(isQuota(e))return src+" is busy (too many requests). It'll retry by itself in a few minutes.";
  if(c==="tool_error")return src+" reported a problem: "+(e.message||"unknown");
  return "Couldn't reach "+src+". Try Refresh.";
}
const I={
  cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  job:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
  people:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  list:'<path d="M5 6h14M5 12h14M5 18h9"/>',
  timer:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2h5"/>',
  chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  task:'<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  play:'<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l5.5-3.5z"/>',
  moon:'<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
  left:'<path d="M15 5l-7 7 7 7"/>',
  right:'<path d="M9 5l7 7-7 7"/>',
  repeat:'<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
  pin:'<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  dots:'<path d="M5 12h.01M12 12h.01M19 12h.01"/>',
  spark:'<path d="M12 3l2.1 5.4L19.5 10l-5.4 2.1L12 17.5 9.9 12.1 4.5 10l5.4-1.6z"/>',
  book:'<path d="M4 4.8A1.8 1.8 0 0 1 5.8 3H19v14H5.8A1.8 1.8 0 0 0 4 18.8z"/><path d="M4 18.8A1.8 1.8 0 0 0 5.8 21H19v-4"/>',
  mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  eyeoff:'<path d="M17.9 17.9A10 10 0 0 1 12 20C5 20 1 12 1 12a18 18 0 0 1 5.1-5.9M9.9 4.2A9 9 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2.2 3.2M1 1l22 22"/>',
  pencil:'<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  down:'<path d="M12 5v14M6 13l6 6 6-6"/>',
  trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  flame:'<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.2 2-4.2 0 2 1 3 2 3 0-3-1-5 1-8.8z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  up:'<path d="M12 19V5M6 11l6-6 6 6"/>',
  auto:'<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor"/>'
};
const ic=(k,s=18,w=1.8)=>'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+w+'" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+I[k]+'</svg>';

/* ---------- data layer: a local store plus plug-ins ---------- */
const uid=p=>(p||"x")+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
function mergeSched(){S.sched=(S.nsched||[]).concat(...Object.values(S.plugTasks||{}))}
function mergeCal(){S.gcal=(S.localEvents||[]).concat(...Object.values(S.plugEvents||{}))}
function saveUI(){try{localStorage.setItem("daybook_ui",JSON.stringify(S.ui))}catch(_){}}
function evMs(e){
  const s=e.allDay?new Date(e.date+"T00:00:00"):new Date(e.date+"T"+(e.time||"00:00")+":00");
  const en=e.endTime&&!e.allDay?new Date(e.date+"T"+e.endTime+":00"):null;
  return Object.assign({},e,{startMs:+s,endMs:en?+en:0});
}
const plugin=id=>Daybook.plugins.find(p=>p.id===id);
const API={
  version:VERSION,today,addDays,pad,esc,toast,
  render:()=>render(),
  config:pid=>(S.ui.plugins[pid]=S.ui.plugins[pid]||{}),
  save:saveUI,
  setTasks(pid,list){S.plugTasks[pid]=(list||[]).map(t=>Object.assign({type:"Task",company:"",notes:"",time:"",endTime:"",done:false,priority:false,removed:false,date:""},t,{plugin:pid}));mergeSched();render()},
  setEvents(pid,list){S.plugEvents[pid]=(list||[]).map(e=>Object.assign({allDay:false,url:"",join:"",endTime:"",src:pid},e));mergeCal();render()},
  looksLikeMeeting:t=>IV_RE.test(String(t||"")),
  idb:{get:idbGet,set:idbSet,del:idbDel}
};
function idbOpen(){return new Promise((res,rej)=>{try{const r=indexedDB.open("daybook",1);r.onupgradeneeded=()=>r.result.createObjectStore("kv");r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}catch(e){rej(e)}})}
async function idbGet(k){const db=await idbOpen();return new Promise((res,rej)=>{const q=db.transaction("kv").objectStore("kv").get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})}
async function idbSet(k,v){const db=await idbOpen();return new Promise((res,rej)=>{const tx=db.transaction("kv","readwrite");tx.objectStore("kv").put(v,k);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)})}
async function idbDel(k){const db=await idbOpen();return new Promise((res,rej)=>{const tx=db.transaction("kv","readwrite");tx.objectStore("kv").delete(k);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)})}

function startData(){
  const db=S.db,t=today();
  const all=(col,fn)=>db.collection(col).onSnapshot(q=>{fn(q.docs.map(d=>Object.assign({id:d.id},d.data())));render()});
  all("tasks",a=>{S.nsched=a;mergeSched()});
  all("apps",a=>{S.apps=a});
  all("ivs",a=>{S.ivs=a});
  all("study",a=>{S.study=a});
  all("courses",a=>{S.courses=a});
  all("events",a=>{S.localEvents=a.map(evMs);mergeCal()});
  all("recurring",a=>{S.recur=a});
  db.collection("pomodoros").where("date",">=",addDays(t,-30)).onSnapshot(q=>{S.pomos=q.docs.map(d=>Object.assign({id:d.id},d.data()));render()});
  db.collection("recurdone").where("date",">=",addDays(t,-60)).onSnapshot(q=>{const o={};q.docs.forEach(d=>{o[d.id]=true});S.recurDone=o;render()});
  db.collection("habits").where("date",">=",addDays(t,-400)).onSnapshot(q=>{const o={};q.docs.forEach(d=>{o[d.id]=d.data()});S.habits=o;S.hLoaded=true;render();habitReminders()});
  db.collection("autodone").onSnapshot(q=>{const o={};q.docs.forEach(d=>{o[d.id]=true});S.autodone=o;render()});
}
async function refreshAll(){
  toast("Refreshing");
  await Promise.all(Daybook.plugins.map(p=>{try{return p.sync&&p.sync(API)}catch(_){return null}}));
  toast("Up to date");
}

/* ---------- writes ---------- */
async function toggleSched(id){
  const t=S.sched.find(x=>x.id===id);if(!t)return;
  if(t.plugin){const pl=plugin(t.plugin);if(pl&&pl.toggleTask)return pl.toggleTask(t,API);toast("This task can't be changed from here.");return}
  t.done=!t.done;render();
  try{await S.db.doc("tasks/"+id).update({done:t.done})}
  catch(e){t.done=!t.done;render();toast("Couldn't save that. Try again.")}
}
async function addTask(){
  const inp=$("#addInput");const name=(inp&&inp.value||"").trim();if(!name)return;
  const dm=name.match(/^(.*\S)[\s,.:;\-\u2013(]+daily\)?\s*$/i);
  if(dm){inp.value="";await addRecurring(dm[1].trim());return}
  const other=S.view==="today"&&S.day&&S.day!==today();
  const date=other?S.day:(S.addWhen==="anytime"?"":S.addWhen==="tomorrow"?addDays(today(),1):today());
  const type=S.addArea==="personal"?"Personal":"Task";
  inp.value="";
  const dest=S.ui.addTo;
  if(dest&&dest!=="local"){
    const pl=plugin(dest);
    if(pl&&pl.addTask){try{await pl.addTask({name,date,type},API);toast("Added to "+pl.name)}catch(e){inp.value=name;toast((e&&e.message)||"Couldn't add that.")}return}
  }
  await S.db.doc("tasks/"+uid("t")).set({name,type,company:"",notes:"",date,time:"",endTime:"",done:false,priority:false,removed:false,src:"Daybook"});
  toast("Added");if(inp)inp.focus();
}
async function markAuto(id,on){
  if(on)S.autodone[id]=true;else delete S.autodone[id];render();
  try{const ref=S.db.doc("autodone/"+id);if(on)await ref.set({at:Date.now()});else await ref.delete()}catch(_){toast("Couldn't save that. Try again.")}
}
async function addApp(){
  const company=($("#aCo").value||"").trim();if(!company){$("#aCo").focus();return}
  await S.db.doc("apps/"+uid("a")).set({company,title:($("#aTitle").value||"").trim(),status:$("#aStatus").value,date:$("#aDate").value||today(),url:($("#aUrl").value||"").trim(),tier:"",warm:false});
  toast("Added \u201c"+company+"\u201d");
}
async function addInterview(){
  const name=($("#iName").value||"").trim();if(!name){$("#iName").focus();return}
  await S.db.doc("ivs/"+uid("i")).set({name,date:$("#iDate").value||today(),time:$("#iTime").value||"",phase:($("#iNotes").value||"").trim(),status:"",url:""});
  toast("Interview added");
}
function delDoc(path,label){
  const [col,id]=[path.slice(0,path.indexOf("/")),path.slice(path.indexOf("/")+1)];
  const prev=S.db.data[col]&&S.db.data[col][id];
  S.db.doc(path).delete().then(()=>{if(prev)toast("Deleted "+(label||"item"),"Undo",()=>S.db.doc(path).set(prev))});
}
async function addCourse(){
  const name=($("#crsName").value||"").trim();if(!name){$("#crsName").focus();return}
  const start=$("#crsStart").value||today();let end=$("#crsEnd").value;if(!end)end=addDays(start,83);
  const days=[...document.querySelectorAll(".crsDay:checked")].map(x=>Number(x.value));
  await S.db.doc("courses/"+uid("c")).set({course:name,start,end,days,time:$("#crsTime").value||""});
  toast("Added \u201c"+name+"\u201d");
}
async function importBackup(file){
  if(!file)return;
  try{
    const o=JSON.parse(await file.text());
    S.db.importJSON(JSON.stringify({app:o.app,data:o.data}));
    if(o.ui){S.ui=mergeUI(o.ui);saveUI();applyUI()}
    if(o.settings){S.settings=Object.assign(S.settings,o.settings);saveSettings()}
    toast("Backup restored");render();
  }catch(e){toast((e&&e.message)||"Couldn't read that file.")}
}
function exportBackup(){
  const txt=JSON.stringify({app:"daybook",version:1,exportedAt:new Date().toISOString(),data:S.db.data,ui:S.ui,settings:S.settings},null,1);
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([txt],{type:"application/json"}));a.download="daybook-backup-"+today()+".json";document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
}

/* ---------- sample data ---------- */
async function seedDemo(keep){
  const t=today(),d=n=>addDays(t,n),db=S.db,P=[];
  const put=(col,id,v)=>P.push(db.doc(col+"/"+id).set(Object.assign({demo:true},v)));
  const T=(name,date,o)=>put("tasks",uid("t"),Object.assign({name,type:"Task",company:"",notes:"",date,time:"",endTime:"",done:false,priority:false,removed:false,src:"Daybook"},o||{}));
  T("Plan the week",d(0));T("Reply to Sam about the proposal",d(0),{priority:true});T("Send the invoice",d(-1));
  T("Prepare slides for Thursday",d(1),{time:"10:00"});T("Book a dentist appointment","",{type:"Personal"});T("Update your portfolio","");
  put("recurring",uid("r"),{name:"Review your inbox",area:"job",start:d(-14),end:null,createdAt:1});
  const ev=(title,date,time,endTime,o)=>put("events",uid("e"),Object.assign({title,date,time,endTime,allDay:false,url:"",join:"",meeting:false,src:"Sample"},o||{}));
  ev("Team standup",d(0),"09:30","09:45",{meeting:true,join:"https://meet.example.com"});ev("Product review",d(1),"15:00","16:00",{meeting:true});ev("Dentist",d(3),"11:00","11:45");
  for(let i=1;i<=5;i++){const n=i%3+1;for(let k=0;k<n;k++)put("pomodoros",uid("p"),{date:d(-i),at:Date.now()-i*86400000+k*1800000,taskId:"free",title:"Free focus",minutes:25})}
  put("pomodoros",uid("p"),{date:d(0),at:Date.now()-3600000,taskId:"free",title:"Free focus",minutes:25});
  const hs=[{id:"hdemo1",name:"Read 10 pages",mode:"daily",goal:3,from:"",to:"",why:"A little every day adds up",link:"",linkLabel:"",demo:true},
            {id:"hdemo2",name:"Go for a run",mode:"weekly",goal:3,from:"12:00",to:"14:00",why:"Energy for the rest of the day",link:"",linkLabel:"",demo:true}];
  hs.forEach(h=>{if(!S.ui.habits.some(x=>x.id===h.id))S.ui.habits.push(h)});saveUI();
  for(let i=1;i<=4;i++)put("habits","hdemo1_"+d(-i),{type:"hdemo1",date:d(-i)});
  put("habits","hdemo2_"+d(-2),{type:"hdemo2",date:d(-2)});
  await Promise.all(P);
  if(!keep){localStorage.setItem("daybook_seen","1");S.firstRun=false;render();toast("Sample data loaded")}else render();
}
async function clearDemo(silent){
  const P=[];
  Object.keys(S.db.data).forEach(col=>Object.keys(S.db.data[col]).forEach(id=>{if(S.db.data[col][id]&&S.db.data[col][id].demo)P.push(S.db.doc(col+"/"+id).delete())}));
  S.ui.habits=S.ui.habits.filter(h=>!h.demo);saveUI();
  await Promise.all(P);render();if(!silent)toast("Sample data removed");
}
const hasDemo=()=>Object.keys(S.db.data).some(col=>Object.keys(S.db.data[col]).some(id=>S.db.data[col][id]&&S.db.data[col][id].demo))||S.ui.habits.some(h=>h.demo);

/* ---------- derived ---------- */
function calendarOn(d){
  const out=[];
  S.gcal.filter(g=>g.date===d).forEach(g=>out.push({key:"g_"+g.id,title:g.title,time:g.allDay?"All day":g.time+(g.endTime?"–"+g.endTime:""),sort:g.allDay?"00:00":g.time,url:g.url,join:g.join,src:"Calendar",endMs:g.endMs}));
  const near=(t)=>out.some(o=>o.sort!=="00:00"&&t&&Math.abs(toMin(o.sort)-toMin(t))<=60);
  S.sched.filter(e=>e.date===d&&!e.removed&&(e.type==="Interview"||e.type==="Call")).forEach(e=>{if(!near(e.time))out.push({key:"s_"+e.id,title:e.name,time:e.time?(e.time+(e.endTime?"–"+e.endTime:"")):"All day",sort:e.time||"00:00",url:e.url,src:"Schedule"})});
  S.ivs.filter(v=>v.date===d).forEach(v=>{if(!near(v.time))out.push({key:"iv_"+v.id,title:v.name,time:v.time||"All day",sort:v.time||"00:00",url:v.url,src:"Interviews"})});
  return out.sort((a,b)=>a.sort.localeCompare(b.sort));
}
const toMin=t=>{const [h,m]=String(t).split(":").map(Number);return h*60+(m||0)};
function prepItems(d){
  const t=today(),items=[];
  [d,addDays(d,1)].forEach(day=>{
    S.gcal.filter(g=>g.date===day&&g.meeting&&!g.allDay&&(day!==t||g.startMs>Date.now())).forEach(g=>items.push({id:"prep_"+g.id,title:"Prep for "+g.title,meta:"Calendar, "+relDay(day)+" at "+g.time,icon:"cal",url:g.url}));
    S.ivs.filter(v=>v.date===day).forEach(v=>{if(!items.some(i=>i.meta.includes(relDay(day))&&i.title.toLowerCase().includes(v.name.split(/[-–:]/)[0].trim().toLowerCase())))items.push({id:"prep_iv_"+v.id,title:"Prep for "+v.name,meta:"Interviews, "+relDay(day)+(v.time?" at "+v.time:""),icon:"cal",url:v.url})});
  });
  return items;
}
function followApps(){
  const t=today();
  const liveIds=new Set(inProcess(S.apps.filter(a=>a.status&&a.tier!=="Skipped"),upcomingInterviews()).map(a=>a.id));
  return S.apps.filter(a=>a.status==="Applied"&&a.tier!=="Skipped"&&a.date&&a.id&&!liveIds.has(a.id)).map(a=>({...a,age:daysBetween(a.date,t)}))
    .filter(a=>a.age>=FOLLOW_MIN&&a.age<=FOLLOW_MAX).sort((a,b)=>b.age-a.age);
}
function schedTasks(d){
  const t=today();
  return S.sched.filter(e=>TASK_TYPES.includes(e.type)&&!e.removed&&e.date&&(d===t?(e.date===d||(e.date<d&&!e.done)):e.date===d))
    .sort((a,b)=>(b.priority-a.priority)||(a.date.localeCompare(b.date))||((a.time||"99").localeCompare(b.time||"99")));
}
function pomosOn(d){return S.pomos.filter(p=>p.date===d)}
function pomoCount(taskId){return S.pomos.filter(p=>p.date===today()&&p.taskId===taskId).length}
function appsToday(){return S.apps.filter(a=>a.date===today()&&a.tier!=="Skipped").length}

/* ---------- pomodoro ---------- */
function loadTheme(){try{const t=localStorage.getItem("daybook_theme");return t==="day"||t==="night"?t:"auto"}catch(_){return "auto"}}
function applyTheme(){const r=document.documentElement;if(S.theme==="day")r.setAttribute("data-theme","light");else if(S.theme==="night")r.setAttribute("data-theme","dark");else r.removeAttribute("data-theme")}
function cycleTheme(){S.theme=S.theme==="auto"?"day":S.theme==="day"?"night":"auto";try{localStorage.setItem("daybook_theme",S.theme)}catch(_){}applyTheme();render();toast(S.theme==="auto"?"Theme follows your device":S.theme==="day"?"Day mode":"Night mode")}
function loadSettings(){try{const s=JSON.parse(localStorage.getItem("daybook_settings")||"{}");return {focus:s.focus||25,brk:s.brk||5,sound:s.sound!==false,notify:s.notify!==false}}catch(_){return {focus:25,brk:5,sound:true,notify:true}}}
function saveSettings(){try{localStorage.setItem("daybook_settings",JSON.stringify(S.settings))}catch(_){}}
function loadTimer(){try{return JSON.parse(localStorage.getItem("daybook_timer")||"null")}catch(_){return null}}
function saveTimer(){try{S.timer?localStorage.setItem("daybook_timer",JSON.stringify(S.timer)):localStorage.removeItem("daybook_timer")}catch(_){}}
function tLeft(){const T=S.timer;if(!T)return S.settings.focus*60;return T.endsAt?Math.max(0,Math.round((T.endsAt-Date.now())/1000)):T.left}
function startFocus(taskId,title){
  const T=S.timer;
  unlockAudio();askNotify();
  if(T&&T.phase==="focus"&&T.taskId===taskId&&!T.endsAt){T.endsAt=Date.now()+T.left*1000;saveTimer();armTimer();render();return}
  const len=S.settings.focus*60;
  S.timer={phase:"focus",taskId:taskId||"free",title:title||"Free focus",len,left:len,endsAt:Date.now()+len*1000};saveTimer();armTimer();render();
}
function pause(){const T=S.timer;if(!T||!T.endsAt)return;T.left=tLeft();T.endsAt=null;saveTimer();render()}
function resume(){const T=S.timer;if(!T||T.endsAt)return;T.endsAt=Date.now()+T.left*1000;unlockAudio();saveTimer();armTimer();render()}
function stop(){S.timer=null;saveTimer();document.title="Daybook";render()}
function startBreak(){unlockAudio();const len=S.settings.brk*60;S.timer={phase:"break",taskId:null,title:"Break",len,left:len,endsAt:Date.now()+len*1000};saveTimer();armTimer();render()}
let finishing=false;
async function finishFocus(){
  if(finishing)return;finishing=true;
  const T=S.timer;const id=Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const rec={date:today(),at:Date.now(),taskId:T.taskId,title:T.title,minutes:Math.round(T.len/60)};
  S.timer={phase:"done",taskId:T.taskId,title:T.title,len:S.settings.brk*60,left:S.settings.brk*60,endsAt:null};saveTimer();
  if(!S.pomos.some(p=>p.at===rec.at))S.pomos.push({id,...rec});
  chime("focus");notify("Pomodoro done","Nice work on "+T.title+". Time for a "+S.settings.brk+" minute break.");document.title="Pomodoro done";render();sayReaction("Focus session done. Take a short break.",{m:"done",hat:"phones",eyes:"happy"});
  if(S.db){try{await S.db.doc("pomodoros/"+id).set(rec)}catch(_){toast("Couldn't save this pomodoro. It shows until you reload.")}}
  finishing=false;
}
let actx=null,alarmEl=null,alarmUrl=null;
function bellWav(){
  // 3 rising bell tones, repeated twice, rendered to a WAV so a plain <audio> element can play it
  const sr=22050,notes=[784,987.8,1174.7],seq=[];for(let r=0;r<3;r++)notes.forEach((f,i)=>seq.push([f,r*1.3+i*0.18]));
  const len=Math.ceil(sr*(3*1.3+1.6)),d=new Float32Array(len);
  seq.forEach(([f,o])=>{const s0=Math.floor(o*sr);for(let i=0;i<sr*1.5&&s0+i<len;i++){const t=i/sr,env=Math.exp(-t*3.2)*Math.min(1,t*200);d[s0+i]+=env*(0.5*Math.sin(2*Math.PI*f*t)+0.15*Math.sin(4*Math.PI*f*t))}});
  let peak=0;for(const v of d)peak=Math.max(peak,Math.abs(v));const k=peak?0.95/peak:1;
  const buf=new ArrayBuffer(44+len*2),v=new DataView(buf),ws=(o,x)=>{for(let i=0;i<x.length;i++)v.setUint8(o+i,x.charCodeAt(i))};
  ws(0,"RIFF");v.setUint32(4,36+len*2,true);ws(8,"WAVE");ws(12,"fmt ");v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
  v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);ws(36,"data");v.setUint32(40,len*2,true);
  for(let i=0;i<len;i++)v.setInt16(44+i*2,Math.max(-1,Math.min(1,d[i]*k))*32767,true);
  return URL.createObjectURL(new Blob([buf],{type:"audio/wav"}));
}
function unlockAudio(){
  try{actx=actx||new (window.AudioContext||window.webkitAudioContext)();if(actx.state==="suspended")actx.resume()}catch(_){}
  try{if(!alarmEl){alarmUrl=bellWav();alarmEl=new Audio(alarmUrl);alarmEl.preload="auto"}
    if(!alarmEl.dataset.ok){alarmEl.muted=true;const p=alarmEl.play();if(p&&p.then)p.then(()=>{alarmEl.pause();alarmEl.currentTime=0;alarmEl.muted=false;alarmEl.dataset.ok="1"}).catch(()=>{alarmEl.muted=false});}}catch(_){}
}
function chime(kind,force){
  if(!S.settings.sound&&!force)return;
  let played=false;
  try{if(alarmEl){alarmEl.muted=false;alarmEl.volume=1;alarmEl.currentTime=0;const p=alarmEl.play();played=true;if(p&&p.catch)p.catch(()=>webChime(kind))}}catch(_){played=false}
  if(!played)webChime(kind);
}
function webChime(kind){
  try{
    if(!actx)unlockAudio();if(!actx)return;if(actx.state==="suspended")actx.resume();
    const out=actx.createGain();out.gain.value=1;out.connect(actx.destination);
    const base=kind==="break"?[[1046.5,0],[784,0.22]]:[[784,0],[987.8,0.16],[1174.7,0.32]];
    const notes=[];for(let r=0;r<3;r++)base.forEach(([f,o])=>notes.push([f,o+r*1.3]));
    notes.forEach(([f,o])=>{
      const t=actx.currentTime+0.03+o;
      [[1,0.5],[2,0.1],[3,0.03]].forEach(([m,v])=>{
        const g=actx.createGain(),osc=actx.createOscillator();osc.type="sine";osc.frequency.value=f*m;
        osc.connect(g);g.connect(out);
        g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(v,t+0.012);g.gain.exponentialRampToValueAtTime(0.0001,t+1.6/m);
        osc.start(t);osc.stop(t+1.7);
      });
    });
  }catch(_){}
}
function askNotify(){try{if(S.settings.notify&&"Notification" in window&&Notification.permission==="default")Notification.requestPermission().then(()=>render()).catch(()=>{})}catch(_){}}
function notifyState(){try{if(!("Notification" in window))return "unsupported";return Notification.permission}catch(_){return "unsupported"}}
function notify(title,body){
  if(!S.settings.notify)return;
  try{if(notifyState()==="granted"){const n=new Notification(title,{body,tag:"nm-pomodoro",silent:false,requireInteraction:true});n.onclick=()=>{try{window.focus()}catch(_){}n.close()}}}catch(_){}
  showAlert(title,body);
}
let flashT=null;
function flashTitle(msg){clearInterval(flashT);let on=false;flashT=setInterval(()=>{if(!document.hidden){clearInterval(flashT);document.title="Daybook";return}on=!on;document.title=on?msg:"Daybook"},1000)}
function showAlert(title,body){flashTitle(title);const a=$("#alert");if(!a)return;a.innerHTML='<b>'+esc(title)+'</b><span>'+esc(body)+'</span><button type="button" data-act="alert-close">OK</button>';a.hidden=false}
let endT=null;function armTimer(){clearTimeout(endT);const T=S.timer;if(T&&T.endsAt){const al=$("#alert");if(al)al.hidden=true;}if(T&&T.endsAt)endT=setTimeout(tick,Math.max(0,T.endsAt-Date.now())+60)}
function tick(){
  const T=S.timer;if(!T||!T.endsAt)return;
  const left=tLeft();
  if(left<=0){if(T.phase==="focus")finishFocus();else{S.timer=null;saveTimer();chime("break");notify("Break's over","Ready for the next pomodoro?");document.title="Daybook";toast("Break's over");render()}return}
  const c=$("#clock");if(c)c.textContent=fmtClock(left);
  const p=$("#prog");if(p)p.style.width=Math.round((1-left/T.len)*100)+"%";
  document.title=fmtClock(left)+" "+(T.phase==="focus"?"Focus":"Break");
}
const fmtClock=s=>pad(Math.floor(s/60))+":"+pad(s%60);


/* ---------- menu + card ---------- */
function localStamp(date,time){const d=new Date(date+"T"+time+":00");const o=-d.getTimezoneOffset(),s=o>=0?"+":"-",a=Math.abs(o);return date+"T"+time+":00"+s+pad(Math.floor(a/60))+":"+pad(a%60)}
async function schedSave(id,_props,optimistic,msg){
  const t=S.sched.find(x=>x.id===id);if(!t)return false;
  if(t.plugin){toast("Change this task where it lives. Daybook can tick it off.");return false}
  const before=Object.assign({},t);Object.assign(t,optimistic);render();
  try{await S.db.doc("tasks/"+id).update(optimistic);if(msg)toast(msg);return true}
  catch(e){Object.assign(t,before);render();toast("Couldn't save that. Try again.");return false}
}
/* ---------- daily tasks ---------- */
async function addRecurring(name){
  if(!S.db){toast("Daily tasks can't be saved in this view");return}
  const start=(S.view==="today"&&S.day&&S.day>today())?S.day:today();
  const id="r"+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
  const doc={name,area:S.addArea==="personal"?"personal":"job",start,end:null,createdAt:Date.now()};
  S.recur.push({id,...doc});render();
  try{await S.db.doc("recurring/"+id).set(doc);toast("Added \u201c"+name+"\u201d as a daily task")}
  catch(_){S.recur=S.recur.filter(r=>r.id!==id);render();toast("Couldn't save that daily task. Try again.")}
}
const DOWS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const recurDays=r=>Array.isArray(r.days)&&r.days.length?r.days:null;
function recurWhen(r){const ds=recurDays(r);const w=ds?ds.slice().sort((a,b)=>((a+6)%7)-((b+6)%7)).map(n=>DOWS[n]).join(", "):"Daily";return w+(r.time?", "+r.time:"")}
function recurOn(d){const w=parse(d).getDay();
  return S.recur.filter(r=>r.start<=d&&(!r.end||r.end>=d)&&(!recurDays(r)||r.days.includes(w)))
    .sort((a,b)=>String(a.time||"99").localeCompare(String(b.time||"99"))||(a.createdAt||0)-(b.createdAt||0))}
const recurDoneKey=(rid,d)=>rid+"_"+d;
async function toggleRecur(rid,d){
  const k=recurDoneKey(rid,d),on=!S.recurDone[k];
  if(on)S.recurDone[k]=true;else delete S.recurDone[k];render();
  if(!S.db)return;
  try{const ref=S.db.doc("recurdone/"+k);if(on)await ref.set({rid,date:d,at:Date.now()});else await ref.delete()}catch(_){toast("Couldn't save that. Try again.")}
}
async function updateRecur(rid,patch,msg){
  const r=S.recur.find(x=>x.id===rid);if(!r||!S.db)return;const before={...r};Object.assign(r,patch);render();
  try{await S.db.doc("recurring/"+rid).update(patch);if(msg)toast(msg)}catch(_){Object.assign(r,before);render();toast("Couldn't save that. Try again.")}
}
function stopRecur(rid){
  const r=S.recur.find(x=>x.id===rid);if(!r)return;const prevEnd=r.end||null;
  const end=r.start>today()?addDays(r.start,-1):addDays(today(),-1);
  updateRecur(rid,{end}).then(()=>toast("Stopped \u201c"+r.name+"\u201d repeating","Undo",()=>updateRecur(rid,{end:prevEnd},"Daily task restored")));
}
function recurRow(r,d){
  return rowHTML({id:r.id+"|"+d,focusId:"r_"+r.id,act:"recur",title:r.name,meta:recurWhen(r)+(r.area==="personal"?", Personal":""),icon:"repeat",done:!!S.recurDone[recurDoneKey(r.id,d)]});
}
/* ---------- learning ---------- */
function learnCourses(){return S.courses.filter(r=>r.course&&r.start).sort((a,b)=>a.start.localeCompare(b.start))}
function lessonDates(r){const out=[];if(!r.start||!r.end)return out;
  for(let d=r.start;d<=r.end;d=addDays(d,1)){if(!recurDays(r)||r.days.includes(parse(d).getDay()))out.push(d)}return out}
function nextLesson(){let best=null;const t=today();
  learnCourses().forEach(r=>{lessonDates(r).forEach(d=>{if(d>=t&&(!best||d<best.date))best={date:d,course:r}})});return best}
function studyOpen(){return S.study.filter(x=>!x.done)}
async function toggleStudy(id){
  const x=S.study.find(e=>e.id===id);if(!x)return;
  x.done=!x.done;render();
  try{await S.db.doc("study/"+id).update({done:x.done})}
  catch(e){x.done=!x.done;render();toast("Couldn't save that. Try again.")}
}
async function addStudy(){
  const name=($("#dName").value||"").trim();if(!name){$("#dName").focus();return}
  await S.db.doc("study/"+uid("s")).set({name,course:$("#dCourse").value,type:$("#dType").value,due:$("#dDue").value,minutes:Number($("#dMin").value)||0,notes:"",done:false});
  toast("Added \u201c"+name+"\u201d");
}
function studyRow(x){
  const t=today();const bits=[x.course,x.type].filter(Boolean);
  bits.push(x.due?(x.due<t&&!x.done?"Overdue, "+fmtShort(x.due):relDay(x.due)):"No date");
  return rowHTML({id:x.id,focusId:"d_"+x.id,act:"learn",title:x.name,meta:bits.join(", "),icon:"book",url:x.url,
    late:!!x.due&&x.due<t&&!x.done,done:x.done});
}
function removeAny(key){
  const kind=key.slice(0,key.indexOf(":")),id=key.slice(key.indexOf(":")+1),o=S.rowInfo[key]||{};
  if(kind==="sched")return deleteTask(id);
  if(kind==="recur")return stopRecur(id.split("|")[0]);
  markAuto("x_"+id,true);toast("Deleted "+(o.title||"task"),"Undo",()=>markAuto("x_"+id,false));
}
function deleteTask(id){
  const t=S.sched.find(x=>x.id===id);if(!t)return;
  schedSave(id,{"Removed":"__YES__"},{removed:true}).then(ok=>{if(ok)toast("Deleted "+t.name,"Undo",()=>schedSave(id,{"Removed":"__NO__"},{removed:false},"Restored"))});
}
function moveTask(id,date){
  schedSave(id,{"date:When:start":date,"date:When:is_datetime":0},{date,time:"",endTime:""},"Moved to "+relDay(date));
}
function togglePriority(id){const t=S.sched.find(x=>x.id===id);if(!t)return;schedSave(id,{"Priority":t.priority?"__NO__":"__YES__"},{priority:!t.priority},t.priority?"Priority removed":"Marked as priority")}
let menuKey=null,menuOpener=null;
function openMenu(key,x,y,opener){
  const o=S.rowInfo[key];if(!o)return;menuKey=key;menuOpener=opener||null;
  const [kind,id]=[key.slice(0,key.indexOf(":")),key.slice(key.indexOf(":")+1)];
  const it=(act,label,cls)=>'<button type="button" role="menuitem" data-act="'+act+'"'+(cls?' class="'+cls+'"':"")+'>'+label+'</button>';
  let h=it("m-card","Open card");
  if(kind==="sched"){const t=S.sched.find(x=>x.id===id)||{};
    h+=it("m-edit","Edit")+it("m-done",t.done?"Mark not done":"Mark done")+it("m-prio",t.priority?"Remove priority":"Mark as priority")+"<hr>"+
      (t.date!==today()?it("m-today","Move to today"):"")+it("m-tomorrow","Move to tomorrow")+it("m-anytime","Move to Anytime")+"<hr>"+
      it("m-focus","Start a pomodoro")+(o.url?'<a role="menuitem" href="'+esc(o.url)+'" target="_blank" rel="noopener">Open in '+esc(t.src||"source")+'</a>':"")+"<hr>"+it("m-del","Delete","danger");
  }else if(kind==="recur"){const [rid,d]=id.split("|");
    h+=it("m-edit","Edit")+it("m-done",S.recurDone[recurDoneKey(rid,d)]?"Mark not done":"Mark done")+it("m-focus","Start a pomodoro")+"<hr>"+it("m-del","Stop repeating","danger");
  }else if(kind==="learn"){const x=S.study.find(e=>e.id===id)||{};
    h+=it("m-done",x.done?"Mark not done":"Mark done")+it("m-focus","Start a pomodoro")+(o.url?'<a role="menuitem" href="'+esc(o.url)+'" target="_blank" rel="noopener">Open in Notion</a>':"");
  }else if(kind==="auto"){
    h+=it("m-done",S.autodone[id]?"Mark not done":"Mark done")+it("m-focus","Start a pomodoro")+(o.url?'<a role="menuitem" href="'+esc(o.url)+'" target="_blank" rel="noopener">Open source</a>':"")+"<hr>"+it("m-hide","Delete","danger");
  }else{
    h+=it("m-done",o.kind==="followed"?"Mark followed up":"Mark messaged")+it("m-focus","Start a pomodoro")+(o.url?'<a role="menuitem" href="'+esc(o.url)+'" target="_blank" rel="noopener">Open in Notion</a>':"")+"<hr>"+it("m-cdel","Delete","danger");
  }
  const m=$("#menu");m.innerHTML=h;m.hidden=false;
  const r=m.getBoundingClientRect();const vw=window.innerWidth,vh=window.innerHeight;
  m.style.left=Math.max(8,Math.min(x,vw-r.width-8))+"px";m.style.top=Math.max(8,Math.min(y,vh-r.height-8))+"px";
  const f=m.querySelector("button,a");if(f)f.focus();
}
function closeMenu(refocus){const m=$("#menu");if(m.hidden)return;m.hidden=true;if(refocus&&menuOpener&&document.body.contains(menuOpener))menuOpener.focus()}
function menuAction(a){
  const key=menuKey;closeMenu(false);if(!key)return;const o=S.rowInfo[key]||{};
  const kind=key.slice(0,key.indexOf(":")),id=key.slice(key.indexOf(":")+1);
  if(a==="m-card")openCard(key,false);
  else if(a==="m-edit")openCard(key,true);
  else if(a==="m-done"){if(kind==="recur"){const [rid,d]=id.split("|");toggleRecur(rid,d)}else if(kind==="sched")toggleSched(id);else if(kind==="learn")toggleStudy(id);else if(kind==="auto")markAuto(id,!S.autodone[id])}
  else if(a==="m-prio")togglePriority(id);
  else if(a==="m-today")moveTask(id,today());
  else if(a==="m-tomorrow")moveTask(id,addDays(today(),1));
  else if(a==="m-anytime")schedSave(id,{"date:When:start":null},{date:"",time:"",endTime:""},"Moved to Anytime");
  else if(a==="m-focus")startFocus(o.focusId,o.title);
  else if(a==="m-del"){if(kind==="recur")stopRecur(id.split("|")[0]);else deleteTask(id)}
  else if(a==="m-hide")removeAny(key);
  else if(a==="m-cdel")removeAny(key);
}
function openCard(key,edit){
  const o=S.rowInfo[key];if(!o)return;const kind=key.slice(0,key.indexOf(":")),id=key.slice(key.indexOf(":")+1);
  const c=$("#card");let h='<div class="cardin">';
  if(kind==="recur"){
    const rid=id.split("|")[0],r=S.recur.find(x=>x.id===rid);if(!r)return;const per=r.area==="personal";
    h+='<h2>'+(recurDays(r)?"Repeating task":"Daily task")+'</h2><label class="sr" for="cName">Task name</label><input class="big" id="cName" value="'+esc(r.name)+'">'+
      '<div class="fld">Area<span class="seg" role="group" aria-label="Area"><button type="button" data-act="c-area" data-v="job" aria-pressed="'+(!per)+'">Work</button><button type="button" data-act="c-area" data-v="personal" aria-pressed="'+per+'">Personal</button></span></div>'+
      '<p class="note">'+(recurDays(r)?"Shows up on "+esc(recurWhen(r))+", from "+esc(fmtShort(r.start))+(r.end?" to "+esc(fmtShort(r.end)):" onwards")+".":"Shows up on every day since "+esc(fmtShort(r.start))+".")+' Ticking it off only counts for that day.</p>'+
      '<div class="cardfoot"><button type="button" class="pill danger" data-act="c-stop">Stop repeating</button><span class="sp"></span><button type="button" class="pill" data-act="c-close">Cancel</button><button type="button" class="pill pri" data-act="c-rsave">Save</button></div>';
    c.dataset.id=rid;c.dataset.area=per?"personal":"job";
  }else if(kind==="learn"){
    const x=S.study.find(e=>e.id===id);if(!x)return;
    h+='<h2>Study task</h2><p style="margin:0;font-size:20px;font-weight:500">'+esc(x.name)+'</p>'+
      '<p class="cmeta">'+esc([x.course,x.type].filter(Boolean).join(", ")||"No course set")+(x.due?", due "+esc(fmtShort(x.due)):", no date")+(x.minutes?", "+x.minutes+" min":"")+'</p>'+
      (x.notes?'<p class="note">'+esc(x.notes)+'</p>':"")+
      '<div class="cardfoot"><button type="button" class="pill danger" data-act="c-study-del">Delete</button>'+
      '<span class="sp"></span><button type="button" class="pill" data-act="c-close">Close</button><button type="button" class="pill pri" data-act="c-learn">'+(x.done?"Mark not done":"Mark done")+'</button></div>';
    c.dataset.id=id;
  }else if(kind==="sched"){
    const t=S.sched.find(x=>x.id===id);if(!t)return;
    const per=t.type==="Personal";
    h+='<label class="sr" for="cName">Task name</label><input class="big" id="cName" value="'+esc(t.name)+'">'+
      '<div class="frow"><label class="fld">Date<input type="date" id="cDate" value="'+esc(t.date)+'"></label><label class="fld">Time (optional)<input type="time" id="cTime" value="'+esc(t.time)+'"></label></div>'+
      '<div class="frow" style="align-items:flex-end"><div class="fld">Area<span class="seg" role="group" aria-label="Area"><button type="button" data-act="c-area" data-v="job" aria-pressed="'+(!per)+'">Work</button><button type="button" data-act="c-area" data-v="personal" aria-pressed="'+per+'">Personal</button></span></div>'+
      '<div class="fld">Priority<span class="seg" role="group" aria-label="Priority"><button type="button" data-act="c-prio" data-v="no" aria-pressed="'+(!t.priority)+'">Normal</button><button type="button" data-act="c-prio" data-v="yes" aria-pressed="'+t.priority+'">Priority</button></span></div></div>'+
      '<label class="fld">Notes<textarea id="cNotes" placeholder="Add details, links, next steps">'+esc(t.notes)+'</textarea></label>'+
      '<div class="cardfoot"><button type="button" class="pill danger" data-act="c-del">Delete</button>'+(t.url?'<a class="linkbtn" href="'+esc(t.url)+'" target="_blank" rel="noopener">Open in '+esc(t.src||"source")+'</a>':"")+'<span class="sp"></span><button type="button" class="pill" data-act="c-close">Cancel</button><button type="button" class="pill pri" data-act="c-save">Save</button></div>';
    c.dataset.id=id;c.dataset.area=per?"personal":"job";c.dataset.prio=t.priority?"yes":"no";c.dataset.type=t.type;
  }else{
    const done=kind==="auto"?!!S.autodone[id]:false;
    h+='<h2>'+(kind==="auto"?"Suggested for you":"Outreach")+'</h2><p style="margin:0;font-size:20px;font-weight:500">'+esc(o.title)+'</p><p class="cmeta">'+esc(o.meta)+'</p>'+
      (kind==="auto"?'<p class="note">This comes from your '+(id.startsWith("fu_")?"job tracker":"calendar")+'. Tick it off when it\'s done, or hide it if it doesn\'t apply.</p>':"")+
      '<div class="cardfoot"><button type="button" class="pill danger" data-act="c-delany">Delete</button>'+(o.url?'<a class="linkbtn" href="'+esc(o.url)+'" target="_blank" rel="noopener">Open source</a>':"")+'<span class="sp"></span><button type="button" class="pill" data-act="c-close">Close</button><button type="button" class="pill pri" data-act="c-quick">'+(kind==="auto"?(done?"Mark not done":"Mark done"):(o.kind==="followed"?"Mark followed up":"Mark messaged"))+'</button></div>';
    c.dataset.key=key;
  }
  c.innerHTML=h+'</div>';c.dataset.kind=kind;c.dataset.key=key;
  if(!c.open)c.showModal();
  const f=edit?c.querySelector("#cName"):c.querySelector(".pill.pri");if(f){f.focus();if(edit&&f.select)f.select()}
}
function saveCard(){
  const c=$("#card"),id=c.dataset.id,t=S.sched.find(x=>x.id===id);if(!t)return;
  const name=$("#cName").value.trim()||t.name,date=$("#cDate").value,time=$("#cTime").value,notes=$("#cNotes").value;
  const area=c.dataset.area,prio=c.dataset.prio==="yes";
  let type=t.type;if(area==="personal")type="Personal";else if(type==="Personal")type="Task";
  const props={"Name":name,"Notes":notes,"Priority":prio?"__YES__":"__NO__","Type":type};
  if(date){if(time){props["date:When:start"]=localStamp(date,time);props["date:When:is_datetime"]=1}else{props["date:When:start"]=date;props["date:When:is_datetime"]=0}}
  else props["date:When:start"]=null;
  c.close();
  schedSave(id,props,{name,notes,priority:prio,type,date,time:date?time:"",endTime:""},"Saved");
}

/* ---------- render pieces ---------- */
function focusCard(){
  const T=S.timer,t=today(),todayP=pomosOn(t);
  const running=!!(T&&T.endsAt),left=tLeft();
  let label="Focus",task="Press play on a task to start "+S.settings.focus+" minutes";
  if(T){label=T.phase==="break"?(running?"On a break":"Break paused"):T.phase==="done"?"Pomodoro done":(running?"Focusing":"Paused");task=T.phase==="done"?"Nice. Take a "+S.settings.brk+" minute break?":(T.phase==="break"?"Stand up, stretch, get water":T.title)}
  let btns="";
  if(!T)btns='<button class="pill pri" data-act="startfree">Start</button>';
  else if(T.phase==="done")btns='<button class="pill pri" data-act="break">Start break</button><button class="pill" data-act="stop">Skip</button>';
  else btns=(running?'<button class="pill pri" data-act="pause">Pause</button>':'<button class="pill pri" data-act="resume">Resume</button>')+'<button class="pill" data-act="stop">Stop</button>';
  const pct=T&&T.phase!=="done"?Math.round((1-left/T.len)*100):(T&&T.phase==="done"?100:0);
  const days=[];for(let i=6;i>=0;i--){const d=addDays(t,-i);days.push({d,n:pomosOn(d).length})}
  const max=Math.max(4,...days.map(x=>x.n));
  const mins=todayP.reduce((s,p)=>s+(p.minutes||0),0);
  return '<section class="focus" aria-label="Focus timer">'+
    '<div class="ftop"><div class="fwhat"><span class="flabel">'+esc(label)+'</span><span class="ftask">'+esc(task)+'</span></div>'+
    '<span class="clock'+(running?" run":"")+'" id="clock" aria-label="Time left">'+(T&&T.phase==="done"?"00:00":fmtClock(left))+'</span>'+
    '<div class="btns">'+btns+'</div></div>'+
    '<div class="prog"><i id="prog" style="width:'+pct+'%"></i></div>'+
    '<div class="fbot"><div class="fcount"><span><b>'+todayP.length+'</b> pomodoro'+(todayP.length===1?"":"s")+' today, '+mins+' min focused</span><div class="dots" aria-hidden="true">'+todayP.slice(0,16).map(()=>"<span></span>").join("")+'</div></div>'+
    '<div class="week" role="img" aria-label="Pomodoros per day, last 7 days: '+esc(days.map(x=>dow(x.d)+" "+x.n).join(", "))+'">'+
    days.map((x,i)=>'<div class="wd'+(i===6?" today":"")+'"><span>'+x.n+'</span><i style="height:'+Math.max(3,Math.round(x.n/max*44))+'px"></i><span>'+esc(dow(x.d).slice(0,2))+'</span></div>').join("")+
    '</div></div>'+(S.db?"":'<p class="warnnote">Pomodoros can\'t be saved in this view, so they\'ll reset on reload.</p>')+'</section>';
}
function rowHTML(o){
  const T=S.timer,on=T&&T.phase==="focus"&&T.taskId===o.focusId;
  const n=pomoCount(o.focusId);
  const meta=esc(o.meta)+(n?", "+n+" pomodoro"+(n>1?"s":""):"");
  const key=o.act+":"+o.id;S.rowInfo[key]=o;
  const ttl='<button type="button" class="ttl tbtn" data-act="card" data-key="'+esc(key)+'">'+esc(o.title)+'</button>';
  return '<div class="row'+(o.done?" done":"")+'" data-key="'+esc(key)+'">'+
    '<button class="chk'+(o.square?" sq":"")+'" aria-pressed="'+(!!o.done)+'" aria-label="'+(o.done?"Mark not done: ":"Mark done: ")+esc(o.title)+'" data-act="'+o.act+'" data-id="'+esc(o.id)+'"'+(o.kind?' data-kind="'+o.kind+'"':"")+(o.busy?" disabled":"")+'><span>'+ic("check",12,3.2)+'</span></button>'+
    '<div class="txt">'+ttl+'<span class="meta">'+ic(o.icon,13,2)+(o.flag?'<span class="flag">Priority</span>':"")+'<span'+(o.late?' class="late"':"")+'>'+meta+'</span>'+(o.extra||"")+'</span></div>'+
    (o.done?"":'<button class="play'+(on?" on":"")+'" aria-label="Start a pomodoro on: '+esc(o.title)+'" data-act="focus" data-id="'+esc(o.focusId)+'" data-title="'+esc(o.title)+'">'+ic("play",19)+'</button>')+
    '<button class="mbtn" aria-label="More options for: '+esc(o.title)+'" aria-haspopup="menu" data-act="menu" data-key="'+esc(key)+'">'+ic("dots",18,2.4)+'</button>'+
  '</div>';
}
function schedRow(e,d){
  const late=e.date<d&&!e.done;
  const meta=(e.type==="Personal"?"Personal":e.type==="Task"?(e.src&&e.src!=="Daybook"?e.src+" task":"Task"):e.type)+(e.company?", "+e.company:"")+(e.time?", "+e.time:"")+(late?", from "+relDay(e.date):"")+(e.demo?", sample":"");
  return rowHTML({id:e.id,focusId:"s_"+e.id,act:"sched",title:e.name,meta,icon:e.type==="Personal"?"home":"task",url:e.url,done:e.done,flag:e.priority,late});
}
function statusLine(){
  const errs=Object.values(S.errs);
  return errs.length?errs.map(e=>'<p class="warnnote">'+esc(e)+'</p>').join(""):"";
}
function addBox(day){
  const seg=(k,v,l)=>'<button type="button" aria-pressed="'+(S[k]===v)+'" data-act="seg" data-k="'+k+'" data-v="'+v+'">'+l+'</button>';
  return '<div class="add"><label class="sr" for="addInput">New task</label>'+ic("list",20)+
    '<input id="addInput" type="text" placeholder="Add a task (end with Daily to repeat it)" autocomplete="off">'+
    '<span class="seg" role="group" aria-label="Area">'+seg("addArea","job","Work")+seg("addArea","personal","Personal")+'</span>'+
    (day?'<span class="note" style="font-size:13px">Adds to '+esc(fmtShort(day))+'</span>':'<span class="seg" role="group" aria-label="When">'+seg("addWhen","today","Today")+seg("addWhen","tomorrow","Tomorrow")+seg("addWhen","anytime","Anytime")+'</span>')+'</div>';
}

/* ---------- views ---------- */
function doneLast(items){return items.slice().sort((a,b)=>(a.done?1:0)-(b.done?1:0)).map(x=>x.html).join("")}
function viewTodayMain(){
  const d=today();const cal=calendarOn(d);
  const loading=S.schedSt==="loading"&&S.gSt==="loading";
  const sched=schedTasks(d);
  const evening=sched.filter(e=>e.time&&e.time>="17:00");
  const day=sched.filter(e=>!evening.includes(e));
  const preps=prepItems(d).filter(p=>!S.autodone["x_"+p.id]);
  const items=[];
  preps.forEach(p=>items.push({done:!!S.autodone[p.id],html:rowHTML({id:p.id,focusId:p.id,act:"auto",title:p.title,meta:p.meta,icon:"cal",url:p.url,done:!!S.autodone[p.id]})}));
  const recs=recurOn(d);recs.forEach(r=>items.push({done:!!S.recurDone[recurDoneKey(r.id,d)],html:recurRow(r,d)}));
  day.forEach(e=>items.push({done:!!e.done,html:schedRow(e,d)}));
  const rows=doneLast(items);
  const openN=recs.filter(r=>!S.recurDone[recurDoneKey(r.id,d)]).length+preps.filter(p=>!S.autodone[p.id]).length+sched.filter(e=>!e.done).length;
  const ad=appsToday();
  return '<div class="tgrid"><div class="col">'+
    dayHeader(d,esc(fmtDay(d))+', '+openN+' to do'+(cal.length?', '+cal.length+' on your calendar':''))+
    statusLine()+focusCard()+
    (cal.length?'<section aria-label="Calendar"><h2>On your calendar</h2>'+cal.map(c=>'<div class="ev'+(c.endMs&&c.endMs<Date.now()?" past":"")+'"><span class="t">'+esc(c.time)+'</span><div class="txt" style="padding:0"><a class="ttl" href="'+esc(c.url)+'" target="_blank" rel="noopener">'+esc(c.title)+'</a><span class="meta">'+esc(c.src)+(c.join?' <a href="'+esc(c.join)+'" target="_blank" rel="noopener">Join call</a>':'')+'</span></div></div>').join("")+'</section>':"")+
    '<section aria-label="To do"><h2>To do</h2><div class="list">'+(rows||'<p class="empty">'+(loading?"Loading your day…":"Nothing due. Add something below, or enjoy the space.")+'</p>')+'</div>'+addBox()+'</section>'+
    (evening.length?'<section aria-label="This evening"><h2>This evening</h2><div class="list">'+doneLast(evening.map(e=>({done:!!e.done,html:schedRow(e,d)})))+'</div></section>':"")+
    (S.ui.modules.job===false?"":'<p class="goals">Daily goal: <b>'+ad+'</b> of '+APPLY_GOAL()+' applications</p>')+
  '</div><aside class="rail" aria-label="Daily habits">'+habitsRail()+'</aside></div>';
}
function dayTitle(d){const t=today();if(d===t)return "Today";if(d===addDays(t,1))return "Tomorrow";if(d===addDays(t,-1))return "Yesterday";return parse(d).toLocaleDateString("en-GB",{weekday:"long"})}
function weekStrip(sel){
  const t=today(),ws=weekStart(sel);
  return '<div class="week" role="group" aria-label="This week">'+[0,1,2,3,4,5,6].map(i=>{const d=addDays(ws,i),n=Math.min(4,dayLoad(d));
    return '<button type="button" class="wk'+(d===sel?" sel":"")+(d===t?" now":"")+'" data-act="day" data-v="'+d+'" aria-label="'+esc(fmtDay(d))+', '+n+' planned"'+(d===sel?' aria-current="date"':"")+'>'+esc(dow(d).slice(0,3))+'<b>'+parse(d).getDate()+'</b><span class="dt">'+Array.from({length:n},()=>"<i></i>").join("")+'</span></button>'}).join("")+'</div>';
}
function dayHeader(d,sub){
  const t=today();
  return '<header class="dayhead"><div><h1>'+esc(dayTitle(d))+'</h1><p class="sub">'+sub+'</p></div>'+
    '<div class="daynav">'+(d!==t?'<button type="button" class="smallbtn" data-act="day" data-v="'+t+'">Today</button>':'')+
    '<button type="button" class="iconbtn" data-act="day" data-v="'+addDays(d,-1)+'" aria-label="Previous day">'+ic("left",18,2)+'</button>'+
    '<button type="button" class="iconbtn" data-act="day" data-v="'+addDays(d,1)+'" aria-label="Next day">'+ic("right",18,2)+'</button>'+
    '<button type="button" class="iconbtn" data-act="pickdate" aria-label="Pick a date">'+ic("cal",18)+'</button><input type="date" id="dayPick" class="sr" tabindex="-1" aria-hidden="true" value="'+d+'"></div></header>'+weekStrip(d);
}
function viewToday(){const d=S.day||today();return d===today()?viewTodayMain():viewOtherDay(d)}
function viewOtherDay(d){
  const t=today(),past=d<t;const cal=calendarOn(d);
  const tasks=schedTasks(d);
  const itemsD=[];const prepsD=past?[]:prepItems(d).filter(p=>!S.autodone["x_"+p.id]);
  if(!past){prepsD.forEach(p=>itemsD.push({done:!!S.autodone[p.id],html:rowHTML({id:p.id,focusId:p.id,act:"auto",title:p.title,meta:p.meta,icon:"cal",url:p.url,done:!!S.autodone[p.id]})}))}
  const recsD=recurOn(d);recsD.forEach(r=>itemsD.push({done:!!S.recurDone[recurDoneKey(r.id,d)],html:recurRow(r,d)}));
  tasks.forEach(e=>itemsD.push({done:!!e.done,html:schedRow(e,d)}));
  const rows=doneLast(itemsD);
  const openN=recsD.filter(r=>!S.recurDone[recurDoneKey(r.id,d)]).length+tasks.filter(e=>!e.done).length+prepsD.filter(p=>!S.autodone[p.id]).length;
  const sub=esc(fmtDay(d))+(past?'':', '+openN+' to do')+(cal.length?', '+cal.length+' on your calendar':'');
  let recap="";
  if(past){
    const pom=pomosOn(d),mins=pom.reduce((s,p)=>s+(p.minutes||0),0);
    const apps=S.apps.filter(a=>a.date===d&&a.tier!=="Skipped");
    const doneN=tasks.filter(e=>e.done).length+recsD.filter(r=>S.recurDone[recurDoneKey(r.id,d)]).length;
    const k=(n,l)=>'<div class="kpi"><b>'+n+'</b><span>'+l+'</span></div>';
    recap='<section aria-label="How the day went"><h2>How the day went</h2><div class="kpis">'+k(pom.length,"pomodoros, "+mins+" min")+k(doneN,"tasks done")+k(S.aSt==="ok"?apps.length:"–","applications")+'</div>'+
      (apps.length?'<div class="tbl" style="margin-top:10px">'+apps.map(a=>'<div class="tr"><a class="grow" href="'+esc(a.url)+'" target="_blank" rel="noopener" style="text-decoration:none">Applied to '+esc(a.company)+'<span class="num"> '+esc(a.title)+'</span></a><span class="num">'+esc(a.status)+'</span></div>').join("")+'</div>':'')+'</section>';
  }
  const calHTML=cal.length?'<section aria-label="Calendar"><h2>'+(past?"Calendar":"On your calendar")+'</h2>'+cal.map(c=>'<div class="ev'+(past?" past":"")+'"><span class="t">'+esc(c.time)+'</span><div class="txt" style="padding:0"><a class="ttl" href="'+esc(c.url)+'" target="_blank" rel="noopener">'+esc(c.title)+'</a><span class="meta"><span>'+esc(c.src)+'</span>'+(!past&&c.join?' <a href="'+esc(c.join)+'" target="_blank" rel="noopener">Join call</a>':'')+'</span></div></div>').join("")+'</section>':"";
  const calNote=(S.gSt==="ok"&&d<addDays(t,-30))?'<p class="note">Calendar events older than 30 days aren\'t loaded.</p>':"";
  return '<div class="col">'+dayHeader(d,sub)+statusLine()+recap+calHTML+calNote+
    '<section aria-label="Tasks"><h2>'+(past?"Tasks for this day":"To do")+'</h2><div class="list">'+(rows||'<p class="empty">'+(past?"No tasks were dated for this day.":"Nothing planned yet.")+'</p>')+'</div>'+addBox(d)+'</section></div>';
}
function dayBlock(d,showEmpty){
  const cal=calendarOn(d);const tasks=schedTasks(d);
  if(!cal.length&&!tasks.length&&!showEmpty)return "";
  let body=cal.map(c=>'<div class="ev"><span class="t">'+esc(c.time)+'</span><div class="txt" style="padding:0"><a class="ttl" href="'+esc(c.url)+'" target="_blank" rel="noopener">'+esc(c.title)+'</a><span class="meta"><span>'+esc(c.src)+'</span>'+(c.join?' <a href="'+esc(c.join)+'" target="_blank" rel="noopener">Join call</a>':'')+'</span></div></div>').join("");
  const rows=doneLast(tasks.map(e=>({done:!!e.done,html:schedRow(e,d)})));
  if(rows)body+='<div class="list">'+rows+'</div>';
  if(!body)body='<p class="empty">Nothing planned</p>';
  const t=today();const label=d===addDays(t,1)?"Tomorrow, "+fmtShort(d):fmtShort(d);
  return '<section><h2>'+esc(label)+'</h2>'+body+'</section>';
}
function viewUpcoming(){
  const t=today();const end=addDays(t,92);let h="";
  for(let i=1;i<=7;i++)h+=dayBlock(addDays(t,i),true);
  let month="",later="",n=0;
  for(let i=8;i<=92;i++){
    const d=addDays(t,i);const blk=dayBlock(d,false);if(!blk)continue;
    const m=parse(d).toLocaleDateString("en-GB",{month:"long",year:"numeric"});
    if(m!==month){month=m;later+='<h3 class="mhead">'+esc(m)+'</h3>'}
    later+=blk;n++;
  }
  const loading=S.gSt==="loading";
  return '<div class="col"><header><h1>Upcoming</h1><p class="sub">Your events and tasks through '+esc(parse(end).toLocaleDateString("en-GB",{day:"numeric",month:"long"}))+'</p></header>'+statusLine()+
    '<h3 class="mhead">Next 7 days</h3>'+h+
    (n?later:'<h3 class="mhead">Later</h3><p class="empty">'+(loading?"Loading your calendar…":"Nothing else in the next 3 months yet.")+'</p>')+'</div>';
}
function viewAnytime(){
  const items=S.sched.filter(e=>TASK_TYPES.includes(e.type)&&!e.removed&&!e.date&&!e.done);
  const job=items.filter(e=>e.type!=="Personal"),per=items.filter(e=>e.type==="Personal");
  const sec=(t,a)=>'<section><h2>'+t+'</h2><div class="list">'+(a.length?a.map(e=>schedRow(e,today())).join(""):'<p class="empty">Nothing here</p>')+'</div></section>';
  const t0=today();
  const recs=S.recur.filter(r=>!r.end||r.end>=t0).sort((a,b)=>(a.start||"").localeCompare(b.start||"")||(a.createdAt||0)-(b.createdAt||0));
  const daily='<section><h2>Repeating tasks</h2><div class="list">'+(recs.length?recs.map(r=>recurRow(r,today())).join(""):'<p class="empty">None yet. Type a task and end it with the word Daily, like \u201cCheck LinkedIn jobs daily\u201d.</p>')+'</div></section>';
  return '<div class="col"><header><h1>Anytime</h1><p class="sub">Tasks without a date, plus everything that repeats.</p></header>'+statusLine()+daily+sec("Work",job)+sec("Personal",per)+'<section>'+addBox()+'</section></div>';
}
function viewFocus(){
  const t=today();const days=[];for(let i=13;i>=0;i--){const d=addDays(t,-i);days.push({d,n:pomosOn(d).length})}
  const max=Math.max(4,...days.map(x=>x.n));
  const wk=S.pomos.filter(p=>p.date>addDays(t,-7));const by={};wk.forEach(p=>{const k=p.title||"Free focus";by[k]=(by[k]||0)+1});
  const top=Object.entries(by).sort((a,b)=>b[1]-a[1]);
  const total14=days.reduce((s,x)=>s+x.n,0);const active=days.filter(x=>x.n).length;
  const opt=(k,v)=>'<button type="button" aria-pressed="'+(S.settings[k]===v)+'" data-act="set" data-k="'+k+'" data-v="'+v+'">'+v+' min</button>';
  const recent=S.pomos.slice().sort((a,b)=>b.at-a.at).slice(0,12);
  return '<div class="col"><header><h1>Focus</h1><p class="sub">Your pomodoros, day by day</p></header>'+focusCard()+
    '<div class="kpis"><div class="kpi"><b>'+pomosOn(t).length+'</b><span>today</span></div><div class="kpi"><b>'+wk.length+'</b><span>last 7 days</span></div><div class="kpi"><b>'+(active?(total14/active).toFixed(1):"0")+'</b><span>average on active days</span></div><div class="kpi"><b>'+Math.round(wk.reduce((s,p)=>s+(p.minutes||0),0)/6)/10+'</b><span>hours this week</span></div></div>'+
    '<section><h2>Last 14 days</h2><div class="bars" role="img" aria-label="Pomodoros per day: '+esc(days.map(x=>fmtShort(x.d)+" "+x.n).join(", "))+'">'+days.map((x,i)=>'<div class="wd'+(i===13?" today":"")+'"><span>'+(x.n||"")+'</span><i style="height:'+Math.max(3,Math.round(x.n/max*96))+'px"></i><span>'+esc(dow(x.d).slice(0,2))+'</span></div>').join("")+'</div></section>'+
    '<section><h2>Where your focus went this week</h2><div class="tbl">'+(top.length?top.map(([k,n])=>'<div class="tr"><span class="grow">'+esc(k)+'</span><span class="num">'+n+'</span></div>').join(""):'<p class="empty">No pomodoros yet this week</p>')+'</div></section>'+
    '<section><h2>Recent sessions</h2><div class="tbl">'+(recent.length?recent.map(p=>'<div class="tr"><span class="num" style="width:110px;flex:none">'+esc(relDay(p.date))+' '+hm(new Date(p.at))+'</span><span class="grow">'+esc(p.title||"Free focus")+'</span><span class="num">'+p.minutes+' min</span></div>').join(""):'<p class="empty">Finished pomodoros show up here</p>')+'</div></section>'+
    '<section><h2>Timer length</h2><div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center"><span class="seg" role="group" aria-label="Focus length">'+[25,30,45,50].map(v=>opt("focus",v)).join("")+'</span><span class="seg" role="group" aria-label="Break length">'+[5,10,15].map(v=>opt("brk",v)).join("")+'</span></div><p class="note" style="margin-top:8px">Focus length, then break length. Changes apply to your next pomodoro.</p></section>'+
    '<section><h2>When a pomodoro ends</h2><div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">'+
      '<span class="seg" role="group" aria-label="Sound"><button type="button" data-act="tog" data-k="sound" data-v="1" aria-pressed="'+S.settings.sound+'">Sound on</button><button type="button" data-act="tog" data-k="sound" data-v="0" aria-pressed="'+(!S.settings.sound)+'">Off</button></span>'+
      '<span class="seg" role="group" aria-label="Notification"><button type="button" data-act="tog" data-k="notify" data-v="1" aria-pressed="'+S.settings.notify+'">Notification on</button><button type="button" data-act="tog" data-k="notify" data-v="0" aria-pressed="'+(!S.settings.notify)+'">Off</button></span>'+
      '<button type="button" class="smallbtn" data-act="testchime">Play the sound</button></div>'+
      '<p class="note" style="margin-top:8px">'+({granted:"Your device will show a notification, even when this tab is in the background.",denied:"Notifications are blocked in your browser for this page, so you'll get the sound and an in-page alert instead.",unsupported:"This browser can't show system notifications here, so you'll get the sound and an in-page alert instead.","default":"Your browser will ask for permission the first time you start a pomodoro."})[notifyState()]+'</p></section>'+
  '</div>';
}
const normTxt=s=>" "+String(s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()+" ";
const GENERIC=new Set(["digital","global","group","international","solutions","systems","marketing","data","tech","technologies","services","consulting","partners","europe","netherlands","holding","software","company","media","capital","energy","health","cloud","network","networks","the"]);
function mentions(hay,company){
  const c=normTxt(company).trim();if(c.length<2)return false;
  const H=normTxt(hay);if(H.includes(" "+c+" "))return true;
  const first=c.split(" ")[0];
  return first.length>=5&&!GENERIC.has(first)&&H.includes(" "+first+" ");
}
function titleScore(hay,title){const w=normTxt(title).trim().split(" ").filter(x=>x.length>3);const H=normTxt(hay);return w.filter(x=>H.includes(" "+x+" ")).length}
function upcomingInterviews(){
  const t=today(),now=Date.now(),out=[];
  S.ivs.filter(v=>v.date&&v.date>=t).forEach(v=>out.push({id:v.id,date:v.date,time:v.time,name:v.name,url:v.url,src:"Interviews"}));
  S.gcal.filter(g=>g.meeting&&!g.allDay&&(g.endMs||g.startMs)>now).forEach(g=>{if(!out.some(o=>o.date===g.date&&o.time&&Math.abs(toMin(o.time)-toMin(g.time))<=60))out.push({date:g.date,time:g.time,name:g.title,url:g.url,src:"Calendar"})});
  S.sched.filter(e=>!e.removed&&(e.type==="Interview"||e.type==="Call")&&e.date>=t).forEach(e=>{if(!out.some(o=>o.date===e.date&&(!o.time||!e.time||Math.abs(toMin(o.time)-toMin(e.time))<=60)))out.push({date:e.date,time:e.time,name:e.name+(e.company&&!e.name.includes(e.company)?" ("+e.company+")":""),url:e.url,src:"Schedule"})});
  return out.sort((a,b)=>(a.date+(a.time||"")).localeCompare(b.date+(b.time||"")));
}
function inProcess(sent,up){
  const t=today(),pool=sent.filter(a=>a.company);
  const pick=(name)=>{const c=pool.filter(a=>mentions(name,a.company));if(!c.length)return null;
    return c.sort((x,y)=>(titleScore(name,y.title)-titleScore(name,x.title))||(LIVE_ST.includes(y.status)-LIVE_ST.includes(x.status))||((y.date||"").localeCompare(x.date||"")))[0]};
  const nextBy={},pastBy={};
  up.forEach(u=>{const a=pick(u.name);if(a&&!nextBy[a.id])nextBy[a.id]=u});
  S.ivs.filter(v=>v.date&&v.date<t).sort((x,y)=>y.date.localeCompare(x.date)).forEach(v=>{const a=pick(v.name);if(a&&!pastBy[a.id]&&v.date>=(a.date||""))pastBy[a.id]=v});
  const res=[];
  pool.forEach(a=>{
    if(a.status==="Rejected")return;
    const next=nextBy[a.id],had=pastBy[a.id];let why="";
    if(next)why="Interview "+relDay(next.date)+(next.time?" "+next.time:"");
    else if(LIVE_ST.includes(a.status))why=a.status;
    else if(had)why="Interviewed "+relDay(had.date)+", waiting";
    if(why)res.push({...a,why,sortKey:next?"0"+next.date+(next.time||""):"1"+(a.date||"")});
  });
  return res.sort((x,y)=>x.sortKey.localeCompare(y.sortKey));
}
const R2_RE=/round\s*[2-9]|\b(2nd|3rd|4th|second|third|final)\b/i;
function funnelData(sent){
  const apps=sent.filter(a=>a.status!=="On Hold");
  const keyOf=v=>{
    const c=apps.filter(a=>a.company&&mentions(v.name,a.company));
    if(c.length){const b=c.sort((x,y)=>titleScore(v.name,y.title)-titleScore(v.name,x.title))[0];return [normTxt(b.company).trim(),b.company]}
    const parts=v.name.split(/\s[-–—]\s/);const lbl=(parts.length>1&&parts[0].split(" ").length>3?parts[parts.length-1]:parts[0]).trim();
    return [normTxt(lbl).trim(),lbl];
  };
  const first=new Map(),r2=new Map();
  S.ivs.forEach(v=>{const [k,l]=keyOf(v);if(!k)return;if(!first.has(k))first.set(k,l);if(R2_RE.test(v.name+" "+v.phase)&&!r2.has(k))r2.set(k,l)});
  apps.filter(a=>LIVE_ST.includes(a.status)&&a.company).forEach(a=>{const k=normTxt(a.company).trim();if(![...first.keys()].some(x=>x===k||mentions(x,a.company)))first.set(k,a.company)});
  return {applied:apps.length,first:[...first.values()],r2:[...r2.values()],offers:apps.filter(a=>a.status==="Offer").length};
}
function funnelHTML(sent){
  const f=funnelData(sent),pct=(a,b)=>b?(Math.round(a/b*1000)/10)+"%":"–";
  const k=(n,l)=>'<div class="kpi"><b>'+n+'</b><span>'+l+'</span></div>';
  return '<section aria-label="Funnel"><h2>Funnel</h2><div class="kpis">'+
    k(f.applied,"applications")+k(f.first.length,"first interviews, "+pct(f.first.length,f.applied)+" of applications")+
    k(f.r2.length,"reached round 2, "+pct(f.r2.length,f.first.length)+" of first interviews")+k(f.offers,"offers")+'</div>'+
    '<p class="note" style="margin-top:10px"><b style="color:var(--ink);font-weight:500">First interviews:</b> '+esc(f.first.join(", ")||"none yet")+'</p>'+
    '<p class="note" style="margin-top:6px"><b style="color:var(--ink);font-weight:500">Round 2:</b> '+esc(f.r2.join(", ")||"none yet")+'</p>'+
    '<p class="note" style="margin-top:6px;font-size:13px">Counted from your interviews and live application statuses. Each company counts once.</p></section>';
}
function viewPipeline(){
  const sent=S.apps.filter(a=>a.status);
  const by=s=>sent.filter(a=>a.status===s).length;
  const t=today(),up=upcomingInterviews(),live=inProcess(sent,up),fu=followApps();
  const k=(n,l)=>'<div class="kpi"><b>'+n+'</b><span>'+l+'</span></div>';
  const week=sent.filter(a=>a.date&&a.date>addDays(t,-7)).length;
  const opts=cur=>APP_STATUSES.map(s=>'<option'+(s===cur?" selected":"")+'>'+s+'</option>').join("");
  const rows=sent.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).map(a=>
    '<div class="tr"><span class="grow">'+(a.url?'<a href="'+esc(a.url)+'" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">'+esc(a.company)+'</a>':esc(a.company))+'<span class="num"> '+esc(a.title)+(a.date?", "+esc(fmtShort(a.date)):"")+'</span></span>'+
    '<label class="sr" for="st_'+esc(a.id)+'">Status for '+esc(a.company)+'</label><select class="mini-sel" id="st_'+esc(a.id)+'" data-app="'+esc(a.id)+'">'+opts(a.status)+'</select>'+
    '<button type="button" class="smallbtn" data-act="app-del" data-id="'+esc(a.id)+'" aria-label="Delete '+esc(a.company)+'">'+ic("trash",14,2)+'</button></div>').join("");
  const form='<div class="pform"><div class="frow"><label style="flex:1 1 150px">Company<input id="aCo" type="text" data-pd="1" placeholder="e.g. Acme" autocomplete="off"></label><label style="flex:2 1 200px">Role<input id="aTitle" type="text" data-pd="1" placeholder="e.g. Product marketing manager" autocomplete="off"></label></div>'+
    '<div class="frow"><label>Status<select id="aStatus" data-pd="1">'+opts("Applied")+'</select></label><label>Date applied<input id="aDate" type="date" data-pd="1" value="'+t+'"></label><label style="flex:2 1 200px">Link (optional)<input id="aUrl" type="url" data-pd="1" placeholder="https://"></label></div>'+
    '<div class="frow"><button type="button" class="pill pri" data-act="app-add" style="flex:none;min-height:42px">Add application</button></div></div>';
  const ivForm='<div class="pform"><div class="frow"><label style="flex:2 1 220px">Interview<input id="iName" type="text" data-pd="1" placeholder="e.g. Acme, hiring manager call" autocomplete="off"></label><label>Date<input id="iDate" type="date" data-pd="1" value="'+t+'"></label><label>Time<input id="iTime" type="time" data-pd="1"></label></div>'+
    '<div class="frow"><label style="flex:1 1 220px">Notes (optional)<input id="iNotes" type="text" data-pd="1" placeholder="Round, interviewer, link"></label><button type="button" class="pill pri" data-act="iv-add" style="flex:none;min-height:42px;align-self:flex-end">Add interview</button></div></div>';
  return '<div class="col"><header><h1>'+esc(tn("job","Job search"))+'</h1><p class="sub">Track applications and interviews. Everything stays in this browser.</p></header>'+statusLine()+
    '<div class="kpis">'+k(sent.length,"applied")+k(sent.filter(a=>a.status==="Applied"&&!live.some(l=>l.id===a.id)).length,"awaiting reply")+k(live.length,"in process")+k(by("Rejected"),"rejected")+k(week,"sent last 7 days")+'</div>'+funnelHTML(sent)+
    '<section><h2>Upcoming interviews</h2><div class="tbl">'+(up.length?up.map(v=>'<div class="tr"><span class="num" style="width:120px;flex:none">'+esc(relDay(v.date))+(v.time?" "+v.time:"")+'</span><span class="grow">'+(v.url?'<a href="'+esc(v.url)+'" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">'+esc(v.name)+'</a>':esc(v.name))+'</span><span class="num">'+esc(v.src)+'</span>'+(v.src==="Interviews"&&v.id?'<button type="button" class="smallbtn" data-act="iv-del" data-id="'+esc(v.id)+'" aria-label="Delete interview">'+ic("trash",14,2)+'</button>':'')+'</div>').join(""):'<p class="empty">None scheduled</p>')+'</div></section>'+
    '<section><h2>In process</h2><div class="tbl">'+(live.length?live.map(a=>'<div class="tr"><span class="grow">'+esc(a.company)+'<span class="num"> '+esc(a.title)+'</span></span><span class="num" style="text-align:right">'+esc(a.why)+'</span></div>').join(""):'<p class="empty">Nothing in process right now</p>')+'</div></section>'+
    '<section><h2>Ready for a follow-up</h2><div class="tbl">'+(fu.length?fu.map(a=>'<div class="tr"><span class="grow">'+esc(a.company)+'<span class="num"> '+esc(a.title)+'</span></span><span class="num">'+a.age+' days</span></div>').join(""):'<p class="empty">No applications in the '+FOLLOW_MIN+' to '+FOLLOW_MAX+' day window</p>')+'</div></section>'+
    '<section><h2>All applications</h2><div class="tbl">'+(rows||'<p class="empty">No applications yet. Add your first one below.</p>')+'</div></section>'+
    '<section><h2>Add an application</h2>'+form+'</section>'+
    '<section><h2>Add an interview</h2>'+ivForm+'</section></div>';
}
function viewLearn(){
  const t=today(),courses=learnCourses(),nx=nextLesson();
  const k=(n,l)=>'<div class="kpi"><b>'+n+'</b><span>'+l+'</span></div>';
  const open=studyOpen(),over=open.filter(x=>x.due&&x.due<t),soon=open.filter(x=>x.due&&x.due>=t),none=open.filter(x=>!x.due);
  const doneWk=S.study.filter(x=>x.done&&(!x.due||x.due>addDays(t,-7)));
  const mins=S.study.filter(x=>x.done).reduce((a,x)=>a+(x.minutes||0),0);
  const dm=x=>parse(x).toLocaleDateString("en-GB",{day:"numeric",month:"short"});
  const dmy=x=>parse(x).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
  const cards=courses.length?courses.map(r=>{
    const L=lessonDates(r),d=L.filter(x=>x<=t).length,left=L.length-d,nx2=L.find(x=>x>=t);
    const state=t<r.start?"Starts in "+daysBetween(t,r.start)+" days":(r.end&&t>r.end?"Finished":"In progress, "+left+" to go");
    return '<div class="kpi"><b>'+L.length+'</b><span style="color:var(--ink);font-weight:600">'+esc(r.course)+' lessons</span>'+
      '<span>'+esc(r.start?dm(r.start)+" \u2013 "+(r.end?dmy(r.end):"open"):"Dates TBD")+'</span><span>'+esc(recurWhen(r))+'</span>'+
      '<span>'+esc(state)+(nx2?", next "+fmtShort(nx2):"")+'</span>'+
      '<button type="button" class="smallbtn" style="margin-top:6px;align-self:flex-start" data-act="course-del" data-id="'+esc(r.id)+'">Remove</button></div>';
  }).join(""):'<p class="empty">No courses yet. Add one below to see lessons and your next class.</p>';
  const sec=(title,arr,empty)=>'<section><h2>'+title+'</h2><div class="list">'+(arr.length?arr.map(studyRow).join(""):'<p class="empty">'+empty+'</p>')+'</div></section>';
  const dayNames=[[1,"Mon"],[2,"Tue"],[3,"Wed"],[4,"Thu"],[5,"Fri"],[6,"Sat"],[0,"Sun"]];
  const cform='<div class="pform"><div class="frow"><label style="flex:2 1 220px">Course or subject<input id="crsName" type="text" data-pd="1" placeholder="e.g. Spanish A2, Piano, Statistics" autocomplete="off"></label><label>First lesson<input id="crsStart" type="date" data-pd="1" value="'+t+'"></label><label>Last lesson<input id="crsEnd" type="date" data-pd="1"></label></div>'+
    '<div class="frow" style="align-items:center"><div class="chips2" role="group" aria-label="Lesson days">'+dayNames.map(([n,l])=>'<label class="daychk"><input type="checkbox" class="crsDay" value="'+n+'"><span>'+l+'</span></label>').join("")+'</div><label style="flex:0 1 130px">Time<input id="crsTime" type="time" data-pd="1"></label></div>'+
    '<p class="note" style="font-size:13px">Leave the days empty for every day. Leave the last lesson empty for a 12 week course.</p>'+
    '<div class="frow"><button type="button" class="pill pri" data-act="course-add" style="flex:none;min-height:42px">Add course</button></div></div>';
  const form='<div class="pform"><div class="frow"><label style="flex:2 1 220px">Task<input id="dName" type="text" data-pd="1" placeholder="e.g. Chapter 3 exercises" autocomplete="off"></label><label>Due<input id="dDue" type="date" data-pd="1"></label></div><div class="frow">'+
    '<label>Course<select id="dCourse" data-pd="1"><option value="">General</option>'+courses.map(c=>'<option'+(nx&&nx.course.id===c.id?" selected":"")+'>'+esc(c.course)+'</option>').join("")+'</select></label>'+
    '<label>Type<select id="dType" data-pd="1">'+STUDY_TYPES.map(x=>'<option>'+x+'</option>').join("")+'</select></label><label style="flex:0 1 110px">Minutes<input id="dMin" type="number" min="0" data-pd="1" placeholder="30"></label>'+
    '<button type="button" class="pill pri" data-act="d-add" style="flex:none;align-self:flex-end;min-height:42px">Add task</button></div></div>';
  return '<div class="col"><header><h1>'+esc(tn("learn","Learning"))+'</h1><p class="sub">Courses, lessons and study tasks in one place.</p></header>'+statusLine()+
    (nx?'<div class="focus"><div class="fwhat"><span class="flabel">Next lesson</span><span class="ftask">'+esc(nx.course.course)+" \u00b7 "+esc(fmtDay(nx.date))+(nx.date===t?", today":"")+(nx.course.time?" \u00b7 "+esc(nx.course.time):"")+'</span></div></div>':"")+
    '<section><h2>Courses</h2><div class="kpis">'+cards+'</div></section>'+
    '<section><h2>Study</h2><div class="kpis">'+k(open.length,"tasks open")+k(doneWk.length,"done last 7 days")+k(Math.round(mins/6)/10,"hours logged")+'</div></section>'+
    (over.length?sec("Overdue",over,""):"")+sec("Next up",soon,"Nothing scheduled.")+(none.length?sec("No date",none,""):"")+(doneWk.length?sec("Done this week",doneWk,""):"")+
    '<section><h2>Add a course</h2>'+cform+'</section><section><h2>Add a study task</h2>'+form+'</section></div>';
}

/* ---------- habits: you define them ---------- */
const hDone=(k,d)=>!!S.habits[k+"_"+(d||today())];
async function setHabit(k,on,d){
  d=d||today();const id=k+"_"+d;
  if(on)S.habits[id]={type:k,date:d,at:Date.now()};else delete S.habits[id];render();if(on&&k.slice(-4)!=="skip")setTimeout(()=>habitReaction(k),30);
  try{const ref=S.db.doc("habits/"+id);if(on)await ref.set({type:k,date:d,at:Date.now()});else await ref.delete()}catch(_){toast("Couldn't save that. Try again.")}
}
function weekStart(d){const x=parse(d),w=(x.getDay()+6)%7;return addDays(d,-w)}
const nowMin=()=>{const x=new Date();return x.getHours()*60+x.getMinutes()};
function habitWeek(h,d){const ws=weekStart(d||today());let n=0;for(let i=0;i<7;i++)if(hDone(h.id,addDays(ws,i)))n++;return n}
function habitStreak(h){
  if(h.mode==="weekly"){
    const g=Number(h.goal)||3;let n=0,ws=weekStart(today());
    if(habitWeek(h,today())>=g)n++;
    ws=addDays(ws,-7);
    while(n<520){let c=0;for(let i=0;i<7;i++)if(hDone(h.id,addDays(ws,i)))c++;if(c<g)break;n++;ws=addDays(ws,-7)}
    return n;
  }
  let n=0,d=today();if(!hDone(h.id,d))d=addDays(d,-1);
  while(hDone(h.id,d)&&n<3650){n++;d=addDays(d,-1)}
  return n;
}
function maxHabitStreak(){let m=0;S.ui.habits.forEach(h=>{if(h.mode!=="weekly")m=Math.max(m,habitStreak(h))});return m}
const habitUnit=h=>h.mode==="weekly"?"week":"day";
function nextHabitWindow(){
  const m=nowMin();
  for(const h of S.ui.habits){
    if(!h.from||!h.to||hDone(h.id)||hDone(h.id+"skip"))continue;
    if(h.mode==="weekly"&&habitWeek(h)>=(Number(h.goal)||3))continue;
    if(m<toMin(h.to))return h.name.toLowerCase()+" window "+h.from+" to "+h.to;
  }
  return "";
}
function habitCard(h){
  const weekly=h.mode==="weekly",g=Number(h.goal)||3,n=habitWeek(h),st=habitStreak(h),done=hDone(h.id),skip=hDone(h.id+"skip");
  const streakTxt=st>1?st+" "+habitUnit(h)+"s in a row":"";
  const dots=weekly?'<span class="wdots" aria-label="'+n+' of '+g+' this week">'+Array.from({length:g},(_,i)=>'<i class="'+(i<n?"on":"")+'"></i>').join("")+'</span><span>'+n+' of '+g+' this week</span>':"";
  const name='<span class="flabel">'+esc(h.name)+'</span>';
  if(done)return '<section class="habit" aria-label="'+esc(h.name)+'">'+name+'<span class="big">Done today</span><span class="hline">'+dots+(streakTxt?'<span>'+streakTxt+'</span>':"")+'</span><button class="linkbtn" style="padding:0;align-self:flex-start" data-act="hab" data-k="'+esc(h.id)+'" data-v="0">Undo</button></section>';
  if(skip)return '<section class="habit" aria-label="'+esc(h.name)+'">'+name+'<span class="hline">Rest day today. '+dots+'</span><button class="linkbtn" style="padding:0;align-self:flex-start" data-act="hab" data-k="'+esc(h.id+"skip")+'" data-v="0">Actually, I can do it</button></section>';
  const m=nowMin();let sub="",hi=false;
  if(h.from&&h.to){const f=toMin(h.from),t2=toMin(h.to);
    if(m<f-60)sub="Window "+h.from+" to "+h.to+".";
    else if(m<f){sub="Window opens in "+(f-m)+" min.";hi=true}
    else if(m<t2){sub="Window is open: "+(t2-m)+" min left.";hi=true}
    else sub="Today's window has passed."}
  const why=h.why?'<span class="why">\u201c'+esc(h.why)+'\u201d</span>':"";
  const link=h.link?'<a class="pill" href="'+esc(h.link)+'" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;text-decoration:none">'+esc(h.linkLabel||"Open")+'</a>':"";
  return '<section class="habit'+(hi?" hi":"")+'" aria-label="'+esc(h.name)+'">'+name+'<span class="big">'+esc(h.name)+'</span>'+(sub?'<span class="hline">'+esc(sub)+'</span>':"")+why+
    '<span class="hline">'+dots+(streakTxt?'<span>'+streakTxt+'</span>':"")+'</span><div class="btns" style="flex-wrap:wrap">'+link+'<button class="pill pri" data-act="hab" data-k="'+esc(h.id)+'" data-v="1">Done today</button>'+(weekly?'<button class="pill" data-act="hab" data-k="'+esc(h.id+"skip")+'" data-v="1">Rest day</button>':"")+'</div></section>';
}
function habitsRail(){
  if(!S.hLoaded)return "";
  if(!S.ui.habits.length)return '<section class="habit"><span class="flabel">Habits</span><span class="hline">Build a streak. Add your first habit in Settings.</span><div class="btns"><button class="pill" data-act="go-habits">Add a habit</button></div></section>';
  return S.ui.habits.map(habitCard).join("");
}
function homeHabitRow(h){
  const done=hDone(h.id),st=habitStreak(h);
  return '<div class="hr'+(done?" done":"")+'"><button class="chk" aria-pressed="'+done+'" aria-label="'+(done?"Mark not done: ":"Mark done: ")+esc(h.name)+'" data-act="hab" data-k="'+esc(h.id)+'" data-v="'+(done?"0":"1")+'"><span>'+ic("check",12,3.2)+'</span></button><span class="ht">'+esc(h.name)+'</span>'+(st>1?'<span class="hm">'+st+' '+habitUnit(h)+'s</span>':"")+'</div>';
}
function habitReminders(){
  if(!S.hLoaded)return;
  const m=nowMin();
  S.ui.habits.forEach(h=>{
    if(!h.from||!h.to||hDone(h.id)||hDone(h.id+"skip"))return;
    if(h.mode==="weekly"&&habitWeek(h)>=(Number(h.goal)||3))return;
    const f=toMin(h.from),t2=toMin(h.to);
    [[f-15,h.name+" in 15 minutes","Get ready."],[f,h.name+": window is open",h.from+" to "+h.to+"."],[Math.max(f+1,t2-30),"Last call: "+h.name,"30 minutes left in today's window."]].forEach(([at,title,body],i)=>{
      if(m<at||m>at+20)return;const key="daybook_remind_"+h.id+"_"+today()+"_"+i;
      try{if(localStorage.getItem(key))return;localStorage.setItem(key,"1")}catch(_){}
      chime("focus");notify(title,(h.why?"\u201c"+h.why+"\u201d ":"")+body);
    });
  });
}
function openHabitDialog(id){
  const h=id?S.ui.habits.find(x=>x.id===id):null,c=$("#card");
  const v=h||{name:"",mode:"daily",goal:3,from:"",to:"",why:"",link:"",linkLabel:""};
  c.innerHTML='<div class="cardin"><h2>'+(h?"Edit habit":"New habit")+'</h2><label class="sr" for="hName">Name</label><input class="big" id="hName" value="'+esc(v.name)+'" placeholder="e.g. Read 10 pages" maxlength="50">'+
    '<div class="fld">How often<span class="seg" role="group" aria-label="How often"><button type="button" data-act="h-mode" data-v="daily" aria-pressed="'+(v.mode!=="weekly")+'">Every day</button><button type="button" data-act="h-mode" data-v="weekly" aria-pressed="'+(v.mode==="weekly")+'">Some days a week</button></span></div>'+
    '<label class="fld" id="hGoalFld"'+(v.mode==="weekly"?"":" hidden")+'>Times per week<input type="number" id="hGoal" min="1" max="7" value="'+Number(v.goal||3)+'"></label>'+
    '<div class="frow"><label class="fld">Window starts (optional)<input type="time" id="hFrom" value="'+esc(v.from)+'"></label><label class="fld">Window ends<input type="time" id="hTo" value="'+esc(v.to)+'"></label></div>'+
    '<label class="fld">Why it matters (optional)<input type="text" id="hWhy" maxlength="120" value="'+esc(v.why)+'" placeholder="Shown on the days you do it"></label>'+
    '<div class="frow"><label class="fld">Link (optional)<input type="url" id="hLink" placeholder="https://" value="'+esc(v.link)+'"></label><label class="fld">Link label<input type="text" id="hLinkLabel" placeholder="Open" maxlength="20" value="'+esc(v.linkLabel)+'"></label></div>'+
    '<div class="cardfoot">'+(h?'<button type="button" class="pill danger" data-act="h-del">Delete</button>':"")+'<span class="sp"></span><button type="button" class="pill" data-act="c-close">Cancel</button><button type="button" class="pill pri" data-act="h-save">Save</button></div></div>';
  c.dataset.kind="habit";c.dataset.id=id||"";c.dataset.hmode=v.mode==="weekly"?"weekly":"daily";
  if(!c.open)c.showModal();$("#hName").focus();
}
function habitSave(){
  const c=$("#card"),name=($("#hName").value||"").trim();if(!name){$("#hName").focus();return}
  const o={name,mode:c.dataset.hmode,goal:Math.max(1,Math.min(7,Number($("#hGoal").value)||3)),from:$("#hFrom").value,to:$("#hTo").value,why:($("#hWhy").value||"").trim(),link:($("#hLink").value||"").trim(),linkLabel:($("#hLinkLabel").value||"").trim()};
  if(o.from&&!o.to)o.to=o.from;if(o.to&&!o.from)o.from=o.to;
  const id=c.dataset.id;
  if(id){const h=S.ui.habits.find(x=>x.id===id);if(h)Object.assign(h,o)}else S.ui.habits.push(Object.assign({id:"h"+Date.now().toString(36)},o));
  c.close();saveUI();render();
}
function habitDelete(){
  const c=$("#card"),id=c.dataset.id,i=S.ui.habits.findIndex(x=>x.id===id);if(i<0)return;
  const h=S.ui.habits[i];c.close();S.ui.habits.splice(i,1);saveUI();render();
  toast("Deleted \u201c"+h.name+"\u201d","Undo",()=>{S.ui.habits.splice(i,0,h);saveUI();render()});
}

/* ---------- home dashboard ---------- */
function ring(p,sz,sw){
  p=Math.max(0,Math.min(1,p||0));const r=(sz-sw)/2,c=2*Math.PI*r;
  return '<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 '+sz+' '+sz+'" aria-hidden="true"><circle cx="'+sz/2+'" cy="'+sz/2+'" r="'+r+'" fill="none" stroke="var(--line2)" stroke-width="'+sw+'"/>'+
    '<circle cx="'+sz/2+'" cy="'+sz/2+'" r="'+r+'" fill="none" stroke="var(--accent)" stroke-width="'+sw+'" stroke-linecap="round" stroke-dasharray="'+c.toFixed(1)+'" stroke-dashoffset="'+(c*(1-p)).toFixed(1)+'" transform="rotate(-90 '+sz/2+' '+sz/2+')"/></svg>';
}
function greeting(){const h=new Date().getHours();return h<5?"Good night":h<12?"Good morning":h<18?"Good afternoon":"Good evening"}
function dayProgress(){
  const d=today(),recs=recurOn(d),sched=schedTasks(d),preps=prepItems(d).filter(p=>!S.autodone["x_"+p.id]);
  const total=recs.length+sched.length+preps.length;
  const done=recs.filter(r=>S.recurDone[recurDoneKey(r.id,d)]).length+sched.filter(e=>e.done).length+preps.filter(p=>S.autodone[p.id]).length;
  return {total,done,left:total-done};
}
function nextEvent(){const now=Date.now();return S.gcal.filter(g=>!g.allDay&&(g.endMs||g.startMs)>now).sort((a,b)=>a.startMs-b.startMs)[0]||null}
function countdown(ms){
  const diff=Math.round((ms-Date.now())/60000);
  if(diff<=0)return "Happening now";
  if(diff<60)return "In "+diff+" min";
  if(diff<720)return "In "+Math.floor(diff/60)+" h"+(diff%60?" "+(diff%60)+" min":"");
  return "";
}
function homeAttention(){
  const t=today(),items=[];
  S.sched.filter(e=>TASK_TYPES.includes(e.type)&&!e.removed&&!e.done&&e.date&&e.date<t).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,4)
    .forEach(e=>items.push({v:"today",t:e.name,m:"Overdue, "+relDay(e.date),w:1}));
  followApps().slice(0,3).forEach(a=>items.push({v:"pipeline",t:"Follow up with "+a.company,m:a.age+" days since applying",w:0}));
  studyOpen().filter(x=>x.due&&x.due<t).slice(0,3).forEach(x=>items.push({v:"learn",t:x.name,m:"Learning, overdue",w:1}));
  prepItems(t).filter(p=>!S.autodone[p.id]&&!S.autodone["x_"+p.id]).slice(0,3).forEach(p=>items.push({v:"today",t:p.title,m:p.meta.split(", ").slice(1).join(", "),w:0}));
  return items;
}
function ringA(p,sz,sw,anim){
  p=Math.max(0,Math.min(1,p||0));const r=(sz-sw)/2,c=2*Math.PI*r;
  return '<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 '+sz+' '+sz+'" aria-hidden="true"><circle cx="'+sz/2+'" cy="'+sz/2+'" r="'+r+'" fill="none" stroke="var(--line2)" stroke-width="'+sw+'"/>'+
    '<circle class="rfill" cx="'+sz/2+'" cy="'+sz/2+'" r="'+r+'" fill="none" stroke="var(--accent)" stroke-width="'+sw+'" stroke-linecap="round" stroke-dasharray="'+c.toFixed(1)+'" stroke-dashoffset="'+(c*(1-p)).toFixed(1)+'" style="--full:'+c.toFixed(1)+'" transform="rotate(-90 '+sz/2+' '+sz/2+')"/></svg>';
}
function homeItems(){
  const d=today(),it=[];
  prepItems(d).filter(p=>!S.autodone["x_"+p.id]).forEach(p=>it.push({t:p.title,done:!!S.autodone[p.id],act:"auto",id:p.id,m:""}));
  recurOn(d).forEach(r=>it.push({t:r.name,done:!!S.recurDone[recurDoneKey(r.id,d)],act:"recur",id:r.id+"|"+d,m:r.time||""}));
  schedTasks(d).forEach(e=>it.push({t:e.name,done:!!e.done,act:"sched",id:e.id,m:e.time||""}));
  return it.sort((a,b)=>(a.done?1:0)-(b.done?1:0));
}
function dayLoad(d){return calendarOn(d).length+schedTasks(d).length}
function homeSummary(dp,ne){
  const t=today(),parts=[];
  if(dp.left)parts.push(dp.left+" task"+(dp.left===1?"":"s")+" to do");
  if(ne&&ne.date===t)parts.push("a call at "+ne.time);
  const hw=nextHabitWindow();if(hw)parts.push(hw);
  if(!parts.length)return dp.total?"Everything planned is done. Enjoy the rest of your day.":"A clear page today.";
  return parts.length===1?parts[0].charAt(0).toUpperCase()+parts[0].slice(1)+".":parts.slice(0,-1).join(", ")+" and "+parts[parts.length-1]+".";
}
const sunIc='<svg width="44" height="44" viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M6 32h32"/><path d="M12 32a10 10 0 0 1 20 0"/><path d="M22 8v4M9 15l3 3M35 15l-3 3"/></svg>';
function viewHome(){
  const t=today(),dp=dayProgress(),ne=nextEvent(),pomT=pomosOn(t),mins=pomT.reduce((s,p)=>s+(p.minutes||0),0);
  const anim=!S._homeSeen;S._homeSeen=true;
  const T=S.timer,running=!!(T&&T.endsAt);
  const ads=appsToday(),up=upcomingInterviews(),live=inProcess(S.apps.filter(a=>a.status&&a.tier!=="Skipped"),up),fu=followApps();
  const open=studyOpen(),over=open.filter(x=>x.due&&x.due<t),nx=nextLesson();
  const att=homeAttention(),items=homeItems();
  const ms=mascotState(),pgOn=S.ui.mascot.on;
  const hop=S._hop&&Date.now()-S._hop<900;
  const pgHero=pgOn?'<span class="pgm'+(hop?" hop":"")+'" role="img" aria-label="'+esc(ms.say)+'">'+pageSVG(ms.o,96)+'</span>':"";
  const loading=S.schedSt==="loading"&&S.gSt==="loading";
  const days=[];for(let i=6;i>=0;i--){const d=addDays(t,-i);days.push(pomosOn(d).length)}
  const mx=Math.max(3,...days);
  const link=(v,l)=>'<button type="button" class="linkbtn" data-act="view" data-v="'+v+'">'+l+'</button>';
  const chip=(c,i)=>'<span class="chp c-'+c+'">'+ic(i,16,1.9)+'</span>';
  const ws=weekStart(t);
  const week='<div class="week" role="group" aria-label="This week">'+[0,1,2,3,4,5,6].map(i=>{const d=addDays(ws,i),n=Math.min(4,dayLoad(d));
    return '<button type="button" class="wk'+(d===t?" t":"")+'" data-act="homeday" data-v="'+d+'" aria-label="'+esc(fmtDay(d))+', '+n+' planned">'+esc(dow(d).slice(0,3))+'<b>'+parse(d).getDate()+'</b><span class="dt">'+Array.from({length:n},()=>"<i></i>").join("")+'</span></button>'}).join("")+'</div>';
  const hero='<header class="hhead"><div class="hgrp">'+pgHero+'<div><p class="eyebrow">'+esc(fmtDay(t))+'</p><h1>'+greeting()+'</h1><p class="hsum">'+esc(homeSummary(dp,ne))+'</p>'+(pgOn?'<p class="nudge">'+esc(mascotNudge(ms,dp))+'</p>':"")+'</div></div>'+
    '<div class="qadd"><label class="sr" for="addInput">Add a task</label>'+ic("plus",18,2)+'<input id="addInput" type="text" placeholder="Add a task" autocomplete="off"><button type="button" data-act="homeadd" aria-label="Add task">'+ic("up",16,2.4)+'</button></div></header>';
  const shown=items.slice(0,5);
  const rows=shown.map(x=>'<div class="hr'+(x.done?" done":"")+'"><button class="chk" aria-pressed="'+x.done+'" aria-label="'+(x.done?"Mark not done: ":"Mark done: ")+esc(x.t)+'" data-act="'+x.act+'" data-id="'+esc(x.id)+'"><span>'+ic("check",12,3.2)+'</span></button><span class="ht">'+esc(x.t)+'</span>'+(x.m?'<span class="hm">'+esc(x.m)+'</span>':"")+'</div>').join("");
  const nextTask=items.find(x=>!x.done);
  const complete=dp.total>0&&!dp.left;
  const dayTile='<section class="tile t-day" aria-label="Your day"><div class="tl">'+chip("blue","sun")+'<span>'+esc(tn("day","Your day"))+'</span>'+link("today","Open")+'</div>'+
    (dp.total?'<div class="trow"><span class="ringwrap">'+ringA(dp.done/dp.total,88,8,anim)+'<span class="rc">'+dp.done+'<small>of '+dp.total+'</small></span></span><div><div class="bigtxt">'+(complete?"Day complete":dp.left+" to go")+'</div><p class="tsub">'+(complete?"Everything planned is done.":nextTask?"Next: "+esc(nextTask.t):"")+'</p></div></div>'+
      '<div>'+rows+(items.length>5?'<p class="tsub" style="padding-top:8px">+ '+(items.length-5)+' more in <button class="linkbtn" style="padding:0" data-act="view" data-v="today">Today</button></p>':"")+'</div>':
      '<p class="empty2">'+(pgOn?pageSVG(ms.o,48):"")+'<span>A clear page. Add a task above to plan your day.</span></p>')+'</section>';
  let nextBody;
  if(ne){const cd=countdown(ne.startMs);
    nextBody='<p class="mid">'+esc(ne.title)+'</p><p class="tsub">'+esc((ne.date===t?"Today":relDay(ne.date))+", "+ne.time+(ne.endTime?" to "+ne.endTime:""))+(cd?", "+esc(cd.toLowerCase()):"")+'</p>'+
      (ne.join?'<div><a class="pill pri sm" href="'+esc(ne.join)+'" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;text-decoration:none">Join call</a></div>':"");
  }else nextBody='<p class="mid">'+(S.gSt==="loading"?"Loading\u2026":"Clear ahead")+'</p><p class="tsub">'+(S.gSt==="loading"?"Checking your calendar.":"No more events on your calendar.")+'</p>';
  const nextTile='<section class="tile" aria-label="Next up"><div class="tl">'+chip("violet","cal")+'<span>'+esc(tn("next","Next up"))+'</span>'+link("upcoming","Upcoming")+'</div>'+nextBody+'</section>';
  const focusBody=T&&T.phase!=="done"?
    '<div class="bigno" id="clock" aria-label="Time left">'+fmtClock(tLeft())+'</div><p class="tsub">'+esc(T.phase==="break"?"On a break":T.title)+'</p><div class="prog"><i id="prog" style="width:'+Math.round((1-tLeft()/T.len)*100)+'%"></i></div><div class="btns">'+(running?'<button class="pill sm pri" data-act="pause">Pause</button>':'<button class="pill sm pri" data-act="resume">Resume</button>')+'<button class="pill sm" data-act="stop">Stop</button></div>':
    '<div class="trow"><div><div class="bigno">'+pomT.length+' <small>today, '+mins+' min</small></div></div><div class="mini" style="flex:1" aria-hidden="true">'+days.map((n,i)=>'<i class="'+(i===6?"on":"")+'" style="height:'+Math.max(3,Math.round(n/mx*40))+'px"></i>').join("")+'</div></div>'+
      '<div>'+(T&&T.phase==="done"?'<button class="pill sm pri" data-act="break">Start break</button>':'<button class="pill sm pri" data-act="startfree">Start focus</button>')+'</div>';
  const focusTile='<section class="tile" aria-label="Focus"><div class="tl">'+chip("orange","timer")+'<span>'+esc(tn("focus","Focus"))+'</span>'+link("focus","Details")+'</div>'+focusBody+'</section>';
  const jobTile='<section class="tile" aria-label="Job search"><div class="tl">'+chip("green","job")+'<span>'+esc(tn("job","Job search"))+'</span>'+link("pipeline","Open")+'</div><div class="bigno">'+(S.aSt==="ok"?ads:"\u2013")+' <small>of '+APPLY_GOAL()+' sent today</small></div>'+
    '<div class="stats"><div><b>'+live.length+'</b><span>in process</span></div><div><b>'+up.length+'</b><span>interviews</span></div><div><b>'+fu.length+'</b><span>follow-ups</span></div></div></section>';
  const learnTile='<section class="tile" aria-label="Learning"><div class="tl">'+chip("yellow","book")+'<span>'+esc(tn("learn","Learning"))+'</span>'+link("learn","Open")+'</div><div class="bigno">'+open.length+' <small>open'+(over.length?", "+over.length+" overdue":"")+'</small></div>'+
    '<p class="tsub">'+(nx?"Next lesson: "+esc(nx.course.course)+", "+esc(nx.date===t?"today":relDay(nx.date))+(nx.course.time?" at "+esc(nx.course.time):""):(S.dSt==="loading"?"Loading\u2026":"No lesson scheduled."))+'</p></section>';
  const habTile='<section class="tile" aria-label="Habits"><div class="tl">'+chip("pink","flame")+'<span>'+esc(tn("habits","Habits"))+'</span>'+link("today","Open")+'</div>'+(S.ui.habits.length?S.ui.habits.slice(0,4).map(homeHabitRow).join(""):'<p class="tsub">Build a streak. Add your first habit.</p><div><button class="pill sm" data-act="go-habits">Add a habit</button></div>')+'</section>';
  const attBody=att.length?'<div class="att">'+att.map(a=>'<button type="button" data-act="view" data-v="'+a.v+'"><span class="ad'+(a.w?"":" b")+'"></span><span class="at">'+esc(a.t)+'</span><span class="am">'+esc(a.m)+'</span></button>').join("")+'</div>':'<p class="empty2">'+(pgOn?pageSVG(ms.o,48):"")+'<span>'+(loading?"Loading\u2026":"Nothing needs you right now.")+'</span></p>';
  const attTile='<section class="tile t-att" aria-label="Needs attention"><div class="tl">'+chip("orange","spark")+'<span>'+esc(tn("att","Needs attention"))+'</span></div>'+attBody+'</section>';
  const map={day:dayTile,next:nextTile,focus:focusTile,job:jobTile,learn:learnTile,habits:habTile,att:attTile};
  S.ui.custom.forEach(c=>{map[c.id]=customTile(c)});if(S.ui.modules.job===false)delete map.job;if(S.ui.modules.learn===false)delete map.learn;
  const ids=tileOrder().filter(id=>!S.ui.hidden.includes(id)&&map[id]);
  const tiles=ids.map(id=>S.editHome?tileEdit(map[id],id):map[id]).join("")||'<p class="empty">All tiles are hidden. Use Customize to show them again.</p>';
  const bar='<div class="hbar"><button type="button" class="smallbtn" data-act="home-edit">'+(S.editHome?"Done":"Customize Home")+'</button></div>';
  return '<div class="home'+(anim?" enter":"")+'">'+hero+statusLine()+welcomeHTML()+week+bar+'<div class="tgrid2'+(S.editHome?" editing":"")+'">'+tiles+'</div>'+(S.editHome?homeEditPanel():"")+'</div>';
}


/* ---------- custom tiles ---------- */
const logN=(c,d)=>Number(c.log&&c.log[d])||0;
function cStreak(c){let n=0,d=today();if(!logN(c,d))d=addDays(d,-1);while(logN(c,d)>0){n++;d=addDays(d,-1)}return n}
function customTile(c){
  const t=today(),n=logN(c,t),days=[];for(let i=6;i>=0;i--)days.push(logN(c,addDays(t,-i)));
  const mx=Math.max(1,Number(c.goal)||0,...days);
  const chip='<span class="chp c-'+esc(c.color||"blue")+'">'+ic(c.type==="habit"?"repeat":"chart",16,1.9)+'</span>';
  let body;
  if(c.type==="habit"){
    const st=cStreak(c);
    body='<div class="bigno">'+st+' <small>day'+(st===1?"":"s")+' in a row</small></div><div class="wdots" aria-hidden="true">'+days.map(v=>'<i class="'+(v?"on":"")+'"></i>').join("")+'</div><div>'+
      (n?'<button class="pill sm" data-act="cnt" data-id="'+esc(c.id)+'" data-d="-1">Undo today</button>':'<button class="pill sm pri" data-act="cnt" data-id="'+esc(c.id)+'" data-d="1">Done today</button>')+'</div>';
  }else{
    body='<div class="bigno">'+n+(c.goal?' <small>of '+Number(c.goal)+' today</small>':' <small>today</small>')+'</div><div class="mini" aria-hidden="true">'+days.map((v,i)=>'<i class="'+(i===6?"on":"")+'" style="height:'+Math.max(3,Math.round(v/mx*40))+'px"></i>').join("")+'</div>'+
      '<div class="btns"><button class="pill sm" data-act="cnt" data-id="'+esc(c.id)+'" data-d="-1" aria-label="Subtract one">\u2212</button><button class="pill sm pri" data-act="cnt" data-id="'+esc(c.id)+'" data-d="1">+ 1</button></div>';
  }
  return '<section class="tile" aria-label="'+esc(c.name)+'"><div class="tl">'+chip+'<span>'+esc(c.name)+'</span></div>'+body+'</section>';
}
function bumpCustom(id,d){
  const c=S.ui.custom.find(x=>x.id===id);if(!c)return;c.log=c.log||{};const t=today();
  let v=Math.max(0,(Number(c.log[t])||0)+d);if(c.type==="habit")v=v>0?1:0;
  if(v)c.log[t]=v;else delete c.log[t];
  const keys=Object.keys(c.log).sort();while(keys.length>400)delete c.log[keys.shift()];
  saveUI();render();
}
function tileEdit(html,id){
  const custom=S.ui.custom.some(c=>c.id===id);
  const b=(a,i,l)=>'<button type="button" class="tbtn2" data-act="'+a+'" data-id="'+esc(id)+'" aria-label="'+l+'">'+ic(i,15,2)+'</button>';
  const bar='<div class="tctl">'+b("tile-up","up","Move earlier")+b("tile-down","down","Move later")+b("tile-rename","pencil","Rename")+(custom?b("tile-del","trash","Delete tile"):b("tile-hide","eyeoff","Hide tile"))+'</div>';
  return html.replace(/^(<section[^>]*>)/,"$1"+bar);
}
function homeEditPanel(){
  const hid=S.ui.hidden.map(id=>{const c=S.ui.custom.find(x=>x.id===id);return '<button type="button" class="smallbtn" data-act="tile-show" data-id="'+esc(id)+'">Show '+esc(c?c.name:tn(id,BNAMES[id]))+'</button>'}).join("");
  return '<section class="tile" aria-label="Customize Home"><div class="tl"><span class="chp c-blue">'+ic("gear",16,1.9)+'</span><span>Customize Home</span></div>'+
    '<p class="tsub">Use the arrows to reorder, the pencil to rename and the eye to hide a tile. Accent colour and density are in <button class="linkbtn" style="padding:0" data-act="view" data-v="settings">Settings</button>.</p>'+
    (hid?'<div class="btns" style="flex-wrap:wrap">'+hid+'</div>':"")+
    '<div class="btns"><button type="button" class="pill sm pri" data-act="tile-new" data-t="counter">New counter</button><button type="button" class="pill sm" data-act="go-habits">Manage habits</button></div></section>';
}
function moveTile(id,dir){
  const o=tileOrder();let i=o.indexOf(id),j=i+dir;
  while(j>=0&&j<o.length&&S.ui.hidden.includes(o[j]))j+=dir;
  if(i<0||j<0||j>=o.length)return;
  const x=o[i];o[i]=o[j];o[j]=x;S.ui.order=o;saveUI();render();
}
function delTile(id){
  const i=S.ui.custom.findIndex(c=>c.id===id);if(i<0)return;
  const c=S.ui.custom[i],ord=S.ui.order.slice(),hid=S.ui.hidden.slice();
  S.ui.custom.splice(i,1);S.ui.order=S.ui.order.filter(x=>x!==id);S.ui.hidden=S.ui.hidden.filter(x=>x!==id);saveUI();render();
  toast("Deleted \u201c"+c.name+"\u201d","Undo",()=>{S.ui.custom.splice(i,0,c);S.ui.order=ord;S.ui.hidden=hid;saveUI();render()});
}
function openTileDialog(mode,id,type){
  const c=$("#card"),cust=S.ui.custom.find(x=>x.id===id),isNew=mode==="new";
  const cur=isNew?"":(cust?cust.name:tn(id,BNAMES[id]||""));
  type=type||"counter";
  let h='<div class="cardin"><h2>'+(isNew?"New tile":"Rename tile")+'</h2><label class="sr" for="tName">Name</label><input class="big" id="tName" value="'+esc(cur)+'" placeholder="'+(isNew?"e.g. Glasses of water":"Tile name")+'" maxlength="40">';
  if(isNew){
    h+='<div class="fld">Type<span class="seg" role="group" aria-label="Type"><button type="button" data-act="t-type" data-v="counter" aria-pressed="true">Daily counter</button></span></div>'+
      '<label class="fld" id="goalFld"'+(type==="habit"?" hidden":"")+'>Daily goal (optional)<input type="number" id="tGoal" min="1" max="999" placeholder="e.g. 8"></label>'+
      '<div class="fld">Colour<span class="seg" role="group" aria-label="Colour">'+["blue","violet","orange","green","yellow","pink"].map((k,i)=>'<button type="button" data-act="t-color" data-v="'+k+'" aria-label="'+k+'" aria-pressed="'+(i===0)+'" style="min-width:36px"><span class="chp c-'+k+'" style="width:18px;height:18px;border-radius:6px"></span></button>').join("")+'</span></div>';
  }
  h+='<div class="cardfoot"><span class="sp"></span><button type="button" class="pill" data-act="c-close">Cancel</button><button type="button" class="pill pri" data-act="t-save">Save</button></div></div>';
  c.innerHTML=h;c.dataset.kind="tile";c.dataset.mode=mode;c.dataset.id=id||"";c.dataset.ttype=type;c.dataset.color="blue";
  if(!c.open)c.showModal();const f=$("#tName");if(f){f.focus();f.select()}
}
function tileSave(){
  const c=$("#card"),name=($("#tName").value||"").trim(),mode=c.dataset.mode,id=c.dataset.id;
  if(mode==="new"){
    if(!name){$("#tName").focus();return}
    const g=Number(($("#tGoal")||{}).value)||0,nid="c"+Date.now().toString(36)+Math.random().toString(36).slice(2,4);
    S.ui.custom.push({id:nid,name,type:c.dataset.ttype,goal:c.dataset.ttype==="habit"?0:g,color:c.dataset.color,log:{}});
    S.ui.order=tileOrder();if(S.ui.order.indexOf(nid)<0)S.ui.order.push(nid);
  }else{
    const cust=S.ui.custom.find(x=>x.id===id);
    if(cust){if(name)cust.name=name}else{if(name)S.ui.names[id]=name;else delete S.ui.names[id]}
  }
  c.close();saveUI();render();
}

/* ---------- settings ---------- */
function viewSettings(){
  const u=S.ui;
  const seg=(act,cur,opts)=>'<span class="seg" role="group">'+opts.map(([v,l])=>'<button type="button" data-act="'+act+'" data-v="'+v+'" aria-pressed="'+(cur===v)+'">'+l+'</button>').join("")+'</span>';
  const sw=Object.keys(ACCENTS).map(k=>'<button type="button" class="swatch" data-act="accent" data-v="'+k+'" aria-pressed="'+(u.accent===k)+'" aria-label="'+k+'" style="background:'+ACCENTS[k][0]+'"></button>').join("");
  const app='<section><h2>Appearance</h2><div class="stack" style="gap:18px"><div class="fld">Accent colour<div class="sw">'+sw+'</div></div><div class="fld">Mode'+seg("setmode",S.theme,[["auto","Auto"],["day","Day"],["night","Night"]])+'</div><div class="fld">Density'+seg("density",u.density,[["cozy","Cozy"],["compact","Compact"]])+'</div></div></section>';
  const msec=mascotSettings(seg);
  const mod='<section><h2>Modules</h2><p class="note" style="margin-bottom:10px">Turn off what you don\'t use. Hidden modules leave the sidebar and Home.</p><div class="stack" style="gap:14px"><div class="fld">Job search'+seg("mod-job",u.modules.job===false?"0":"1",[["1","On"],["0","Off"]])+'</div><div class="fld">Learning'+seg("mod-learn",u.modules.learn===false?"0":"1",[["1","On"],["0","Off"]])+'</div><label class="fld">Applications to send per day<input id="applyGoal" data-pd="1" type="number" min="1" max="20" value="'+APPLY_GOAL()+'" style="max-width:120px"></label></div></section>';
  const hrows=u.habits.map(h=>'<div class="conn"><div class="cm"><b>'+esc(h.name)+'</b> <span class="tag">'+(h.mode==="weekly"?(Number(h.goal)||3)+" a week":"Daily")+'</span>'+(h.from?' <span class="tag">'+esc(h.from)+' to '+esc(h.to)+'</span>':"")+(h.why?'<p>\u201c'+esc(h.why)+'\u201d</p>':"")+'</div><button type="button" class="smallbtn" data-act="hab-edit" data-id="'+esc(h.id)+'">Edit</button></div>').join("");
  const habs='<section><h2>Habits</h2><p class="note" style="margin-bottom:6px">Your own habits. Set a time window to get reminders, a reason to see on the day, and a link such as a reading app.</p>'+(hrows||'<p class="empty">No habits yet.</p>')+'<div style="margin-top:10px"><button type="button" class="pill sm pri" data-act="hab-new">Add a habit</button></div></section>';
  const dot=st=>'<span class="dot '+(st==="ok"?"ok":st==="error"?"err":"")+'"></span>';
  const crow=(name,tags,desc,st,actions)=>'<div class="conn"><div class="cm"><b>'+name+'</b> '+tags.map(t=>'<span class="tag">'+t+'</span>').join(" ")+'<p>'+desc+'</p>'+(actions||"")+'</div><span class="st">'+st+'</span></div>';
  const pl=Daybook.plugins.map(p=>{let st={state:"off",text:"Not connected"};try{st=p.status?p.status(API):st}catch(_){}
    let body="";try{body=p.settings?p.settings(API):""}catch(e){body='<p class="warnnote">This plug-in\'s settings failed to load.</p>'}
    return crow(esc(p.name),(p.provides||[]).map(esc),esc(p.desc||""),dot(st.state)+esc(st.text||""),body)}).join("");
  const planned=(n,k,d)=>crow(n,[k,"Planned"],d,dot("")+"Coming soon","");
  const plug='<section><h2>Plug-ins</h2><p class="note" style="margin-bottom:6px">Each connection is a small plug-in. Anyone can write one, see docs/PLUGINS.md.</p>'+pl+
    planned("Google Calendar","Events","Your events, with join links.")+planned("Outlook Calendar","Events","Microsoft 365 and Outlook events.")+planned("Todoist","Tasks","Tasks and projects from Todoist.")+'</section>';
  const dests=[["local","Daybook"]].concat(Daybook.plugins.filter(p=>p.addTask).map(p=>[p.id,p.name]));
  const dp=plugin(u.addTo);
  const dest='<section><h2>New tasks</h2><p class="note" style="margin-bottom:10px">Where the quick-add field on Home and Today saves new tasks.</p>'+seg("addto",u.addTo,dests)+
    (dp&&dp.canAdd&&!dp.canAdd(API)?'<p class="warnnote" style="margin-top:8px">Connect '+esc(dp.name)+' above first, otherwise new tasks can\'t be saved.</p>':"")+'</section>';
  const data='<section><h2>Your data</h2><p class="note" style="margin-bottom:10px">Everything is stored in this browser. Nothing leaves your device unless you connect a plug-in. Export a backup now and then.</p><div class="btns" style="flex-wrap:wrap;align-items:center">'+
    '<button type="button" class="pill sm" data-act="data-export">Export backup</button><label class="pill sm" style="display:inline-flex;align-items:center;cursor:pointer">Import backup<input id="importFile" class="sr" type="file" accept="application/json,.json"></label>'+
    (hasDemo()?'<button type="button" class="pill sm" data-act="demo-clear">Remove sample data</button>':'<button type="button" class="pill sm" data-act="demo-load">Load sample data</button>')+
    '<button type="button" class="pill sm danger" data-act="data-wipe">'+(S._wipe?"Click again to erase everything":"Erase all data")+'</button></div></section>';
  const about='<section><h2>About</h2><p class="note">Daybook '+VERSION+'. Open source under the MIT licence. Made to be shaped by you.</p></section>';
  return '<div class="col"><header><h1>Settings</h1><p class="sub">Make Daybook yours: looks, modules, habits and connections.</p></header>'+app+msec+mod+habs+plug+dest+data+about+
    '<section><h2>Home tiles</h2><p class="note">Reorder, rename, hide or add your own counters from Home with the Customize button.</p><div style="margin-top:10px"><button type="button" class="pill sm" data-act="go-customize">Customize Home</button></div></section></div>';
}
/* ---------- Page, the mascot (drawing lives in js/mascot.js) ---------- */
function pageSVG(o,size,cls){
  return DaybookMascot.page(o,size,cls,{accent:(ACCENTS[S.ui.accent]||ACCENTS.blue)[0],status:S.ui.mascot.colour==="status"});
}
function logoSVG(size){return DaybookMascot.logo(size)}
const PAGE_STATES=[
  {k:"idle",label:"Idle",desc:"Nothing planned yet",o:{m:"idle",hat:"beanie"}},
  {k:"pending",label:"Pending",desc:"Tasks to do today",o:{m:"pending",hat:"beanie"}},
  {k:"overdue",label:"Overdue",desc:"Something is late",o:{m:"overdue",eyes:"worry",mouth:"worry",drop:1}},
  {k:"done",label:"Done",desc:"Every task ticked",o:{m:"done",hat:"party",eyes:"happy",mouth:"grin",conf:1}},
  {k:"focus",label:"Focusing",desc:"A pomodoro is running",o:{m:"focus",hat:"phones",eyes:"focus",mouth:"flat"}},
  {k:"night",label:"Night",desc:"After 22:00",o:{m:"night",hat:"night",eyes:"sleep",mouth:"sleep",zz:1}},
  {k:"learn",label:"Learning",desc:"Lesson today",o:{m:"idle",hat:"grad"}},
  {k:"streak",label:"Streak",desc:"A habit hits 7 days",o:{m:"idle",hat:"crown",eyes:"happy"}}
];
function mascotState(){
  const t=today(),T=S.timer,h=new Date().getHours(),dp=dayProgress();
  const over=S.sched.some(e=>TASK_TYPES.includes(e.type)&&!e.removed&&!e.done&&e.date&&e.date<t)||studyOpen().some(x=>x.due&&x.due<t);
  let m="idle";
  if(T&&T.phase==="focus"&&T.endsAt)m="focus";
  else if(dp.total>0&&!dp.left)m="done";
  else if(h>=22||h<5)m="night";
  else if(over)m="overdue";
  else if(dp.left>0)m="pending";
  const nl=nextLesson(),learn=S.view==="learn"||!!(nl&&nl.date===t);
  const iv=upcomingInterviews().some(u=>u.date===t);
  let st=maxHabitStreak();
  const o={m,tie:iv};
  if(m==="focus"){o.hat="phones";o.eyes="focus";o.mouth="flat"}
  else if(m==="night"){o.hat="night";o.eyes="sleep";o.mouth="sleep";o.zz=1}
  else if(m==="overdue"){o.eyes="worry";o.mouth="worry";o.drop=1}
  else if(m==="done"){o.hat="party";o.eyes="happy";o.mouth="grin";o.conf=1}
  else if(learn)o.hat="grad";
  else if(st>=7){o.hat="crown";o.eyes="happy"}
  else o.hat="beanie";
  const say={idle:"Page is relaxed",pending:"Page is ready for your tasks",overdue:"Page is worried about overdue tasks",done:"Page is celebrating a finished day",focus:"Page is focusing with headphones",night:"Page is sleepy"}[m];
  return {m,o,say};
}

/* ---------- reactions and nudges ---------- */
function mascotNudge(ms,dp){
  const h=new Date().getHours(),t=today();
  if(S.firstRun)return "Hi, I'm Page. Tick something to see what I do.";
  if(ms.m==="focus")return "Focus mode is on. I'll stay quiet.";
  if(ms.m==="done")return "Day complete. Nicely done.";
  if(ms.m==="night")return "It's late. Time to rest.";
  if(ms.m==="overdue"){const n=S.sched.filter(e=>TASK_TYPES.includes(e.type)&&!e.removed&&!e.done&&e.date&&e.date<t).length;return n?n+" late. Start with the oldest.":"Something is late. Have a look below."}
  if(ms.m==="pending"){
    if(dp.left===1)return "One left. Finish strong.";
    if(dp.done===0&&h>=11)return "Nothing ticked yet. Pick the smallest one.";
    return dp.done?dp.done+" done, "+dp.left+" to go.":"Start with whatever feels easiest.";
  }
  return "A clear page. Add something above.";
}
let reactT=null;
function confetti(){
  const cols=["#FF2D95","#FFD60A","#22D3EE","#8B5CF6","#2EE6A8","#FF7A1A"];
  for(let i=0;i<28;i++){
    const c=document.createElement("i");c.className="confetti";
    c.style.left=(Math.random()*100)+"vw";c.style.background=cols[i%cols.length];
    c.style.animationDelay=(Math.random()*0.5)+"s";c.style.animationDuration=(1.3+Math.random()*1.2)+"s";
    document.body.appendChild(c);setTimeout(()=>c.remove(),3400);
  }
}
function sayReaction(msg,o,big){
  if(!S.ui.mascot.on)return;
  let el=document.getElementById("react");
  if(!el){el=document.createElement("div");el.id="react";el.className="react";el.setAttribute("role","status");document.body.appendChild(el)}
  el.classList.remove("on");
  el.innerHTML='<span class="bub2">'+esc(msg)+'</span><span class="pgr">'+pageSVG(o,88)+'</span>';
  void el.offsetWidth;el.classList.add("on");
  clearTimeout(reactT);reactT=setTimeout(()=>el.classList.remove("on"),big?5200:4200);
  if(big&&!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches))confetti();
}
function afterTick(before){
  if(!S.ui.mascot.on)return;
  const dp=dayProgress();if(dp.left>=before)return;
  if(dp.total>0&&dp.left===0){sayReaction("Day complete. Nicely done.",{m:"done",hat:"party",eyes:"happy",mouth:"grin",conf:1},true);return}
  const msg=dp.left===1?"Last one. You've got this.":dp.done===1?"First one down. "+dp.left+" to go.":["Nice.","Done.","Keep going."][dp.done%3]+" "+dp.left+" to go.";
  sayReaction(msg,{m:"done",hat:"beanie",eyes:"happy"});
}
function habitReaction(k){
  if(!S.ui.mascot.on)return;
  const h=S.ui.habits.find(x=>x.id===k);if(!h)return;
  const st=habitStreak(h),unit=habitUnit(h),big=[7,14,30,50,100].indexOf(st)>=0;
  sayReaction(big?h.name+": "+st+" "+unit+"s in a row!":st>1?h.name+" done. "+st+" "+unit+"s in a row.":h.name+" done.",
    big?{m:"done",hat:"crown",eyes:"happy"}:{m:"done",hat:"beanie",eyes:"happy"},big);
}
function mascotSettings(seg){
  const mc=S.ui.mascot;
  return '<section><h2>Mascot</h2><div class="stack" style="gap:16px"><div class="fld">Page on Home'+seg("mascot-on",mc.on?"1":"0",[["1","Show"],["0","Hide"]])+'</div>'+
    '<div class="fld">Colour'+seg("mascot-col",mc.colour,[["status","Changes with my day"],["accent","Always my accent"]])+'</div>'+
    '<div class="fld">How Page reacts<div class="pgrid">'+PAGE_STATES.map(x=>'<div class="pgc">'+pageSVG(x.o,84)+'<b>'+x.label+'</b>'+x.desc+'</div>').join("")+'</div></div>'+
    '<p class="note" style="font-size:13px">Colour is never the only signal: the face and hat change too. The first matching rule wins, in this order: focusing, done, night, overdue, pending.</p></div></section>';
}


const STARTERS=[
  {id:"notion",name:"Notion planner",desc:"Your Notion tasks, with today front and centre.",order:["day","next","att","focus","habits"],hide:[],density:"cozy",next:"plugins"},
  {id:"calendar",name:"Calendar and focus",desc:"Your events, your tasks and a focus timer.",order:["next","day","focus","habits","att"],hide:[],density:"cozy",next:"plugins"},
  {id:"second",name:"Second brain",desc:"Notion and Obsidian together: tasks and notes in one place.",order:["day","att","next","focus","habits"],hide:[],density:"cozy",next:"plugins"},
  {id:"today",name:"Just today",desc:"Only your day, what is next and a timer.",order:["day","next","focus"],hide:["att","habits"],density:"compact",next:null}
];
async function applyStarter(id){
  const st=STARTERS.find(s=>s.id===id);if(!st)return;
  await clearDemo(true);
  const rest=BUILTIN.filter(x=>st.order.indexOf(x)<0);
  S.ui.order=st.order.concat(rest);
  S.ui.hidden=st.hide.filter(x=>BUILTIN.indexOf(x)>=0);
  S.ui.density=st.density;S.ui.starter=id;
  saveUI();applyUI();
  try{localStorage.setItem("daybook_seen","1")}catch(_){}
  S.firstRun=false;
  if(st.next==="plugins"){
    S._vAnim=true;S.view="settings";render();
    const h=[...document.querySelectorAll(".col h2")].find(x=>x.textContent==="Plug-ins");if(h)h.scrollIntoView({block:"start"});
    toast("Layout set. Connect your tools below.");
  }else{S.view="home";render();window.scrollTo(0,0);toast("Layout set. Add your first task.")}
}
function welcomeHTML(){
  if(!S.firstRun)return "";
  const cards=STARTERS.map(s=>'<button type="button" class="starter" data-act="starter" data-id="'+s.id+'"><b>'+esc(s.name)+'</b><span>'+esc(s.desc)+'</span></button>').join("");
  return '<section class="tile" aria-label="Welcome"><div class="tl"><span class="chp c-blue">'+ic("spark",16,1.9)+'</span><span>Welcome to Daybook</span></div>'+
    '<p class="mid">This is a sample day. Tick something and watch Page.</p><p class="tsub">Pick a starting layout when you are ready. You can change everything later, and your own data replaces the sample.</p>'+
    '<div class="starters">'+cards+'</div><div class="btns"><button class="pill sm" data-act="demo-skip">Start empty</button></div></section>';
}
/* ---------- main render ---------- */
const VIEWS={home:["Home","home",viewHome],today:["Today","sun",viewToday],upcoming:["Upcoming","cal",viewUpcoming],anytime:["Anytime","list",viewAnytime],focus:["Focus","timer",viewFocus],pipeline:["Job search","chart",viewPipeline],learn:["Learning","book",viewLearn],settings:["Settings","gear",viewSettings]};
function themeBtn(){
  const cur={auto:["Auto","auto"],day:["Day","sun"],night:["Night","moon"]}[S.theme];
  const next={auto:"Day",day:"Night",night:"Auto"}[S.theme];
  return '<div class="navh">Appearance</div><button class="nav" data-act="theme" aria-label="Theme: '+cur[0]+'. Switch to '+next+'">'+ic(cur[1])+'<span>'+cur[0]+' mode</span><span class="n">Switch</span></button>';
}
function sideHTML(){
  const t=today();
  const todayN=recurOn(t).filter(r=>!S.recurDone[recurDoneKey(r.id,t)]).length+schedTasks(t).filter(e=>!e.done).length+prepItems(t).filter(p=>!S.autodone[p.id]&&!S.autodone["x_"+p.id]).length;
  const dOpen=studyOpen().filter(x=>x.due&&x.due<=t).length;
  const counts={learn:dOpen||"",today:todayN||"",focus:pomosOn(t).length?pomosOn(t).length+" today":""};
  const nav=k=>'<button class="nav" data-act="view" data-v="'+k+'"'+(S.view===k?' aria-current="page"':"")+'>'+ic(VIEWS[k][1])+'<span>'+esc(k==="learn"?tn("learn","Learning"):k==="pipeline"?tn("job","Job search"):VIEWS[k][0])+'</span>'+(counts[k]?'<span class="n">'+counts[k]+'</span>':"")+'</button>';
  const src=(l,st)=>'<span class="srow"><span class="dot '+(st==="ok"?"ok":st==="error"?"err":"")+'"></span>'+esc(l)+'</span>';
  const m=S.ui.modules;
  const plugs=Daybook.plugins.map(p=>{let st={state:"off"};try{st=p.status?p.status(API):st}catch(_){}return st.state==="off"?"":src(p.name,st.state)}).join("");
  return '<div class="brand">'+logoSVG(56)+'Daybook</div>'+nav("home")+nav("today")+nav("upcoming")+nav("anytime")+nav("focus")+(m.job!==false?'<div class="navh">Career</div>'+nav("pipeline"):"")+(m.learn!==false?'<div class="navh">Personal</div>'+nav("learn"):"")+
    themeBtn()+nav("settings")+'<div class="sync">'+plugs+'<button class="linkbtn" data-act="refresh">Refresh plug-ins</button></div>';
}
function render(){
  const a=document.activeElement;const keep=a&&a.id==="addInput"?{v:a.value,s:a.selectionStart}:null;
  const prevV=$("#addInput")?$("#addInput").value:"";
  const pFocus=a&&a.dataset&&a.dataset.pd?{id:a.id,s:a.selectionStart}:null;
  S.rowInfo={};$("#side").innerHTML=sideHTML();
  const mn=$("#main");mn.dataset.v=S.view;mn.className=S._vAnim?"venter":"";S._vAnim=false;
  mn.innerHTML=VIEWS[S.view][2]();
  if(pFocus){const el=document.getElementById(pFocus.id);if(el){el.focus();try{if(pFocus.s!=null)el.setSelectionRange(pFocus.s,pFocus.s)}catch(_){}}}
  const inp=$("#addInput");if(inp){inp.value=keep?keep.v:prevV;if(keep){inp.focus();try{inp.setSelectionRange(keep.s,keep.s)}catch(_){}}}
}

/* ---------- events ---------- */
document.addEventListener("click",e=>{
  if(e.target.closest("#toastBtn")){const f=toastFn;toastFn=null;$("#toast").classList.remove("on");if(f)f();return}
  if(!e.target.closest("#menu"))closeMenu(false);
  const el=e.target.closest("[data-act]");if(!el)return;
  const a=el.dataset.act,id=el.dataset.id;
  if(a.indexOf("plug:")===0){const [,pid,pa]=a.split(":");const pl=plugin(pid);if(pl&&pl.onAction){try{pl.onAction(pa,el,API)}catch(err){console.error(err);toast("That plug-in hit a problem.")}}return}
  if(a==="view"){S._vAnim=S.view!==el.dataset.v;S.view=el.dataset.v;if(S.view==="today")S.day=null;render();window.scrollTo(0,0)}
  else if(a==="day"){S.day=el.dataset.v===today()?null:el.dataset.v;render()}
  else if(a==="pickdate"){const i=$("#dayPick");if(i){try{i.showPicker()}catch(_){i.focus()}}}
  else if(a==="sched"){S._hop=Date.now();const b=dayProgress().left;toggleSched(id);afterTick(b)}
  else if(a==="learn")toggleStudy(id);
  else if(a==="recur"){S._hop=Date.now();const b=dayProgress().left;const [rid,d]=id.split("|");toggleRecur(rid,d);afterTick(b)}
  else if(a==="auto"){S._hop=Date.now();const b=dayProgress().left;markAuto(id,!S.autodone[id]);afterTick(b)}
  else if(a==="focus")startFocus(id,el.dataset.title);
  else if(a==="startfree"){unlockAudio();const first=document.querySelector('.play');if(first)startFocus(first.dataset.id,first.dataset.title);else startFocus("free","Free focus")}
  else if(a==="pause")pause();
  else if(a==="resume")resume();
  else if(a==="stop")stop();
  else if(a==="break")startBreak();
  else if(a==="seg"){S[el.dataset.k]=el.dataset.v;render()}
  else if(a==="set"){S.settings[el.dataset.k]=Number(el.dataset.v);saveSettings();render()}
  else if(a==="tog"){S.settings[el.dataset.k]=el.dataset.v==="1";saveSettings();if(el.dataset.k==="notify"&&S.settings.notify)askNotify();render()}
  else if(a==="testchime"){unlockAudio();chime("focus",true)}
  else if(a==="alert-close"){$("#alert").hidden=true}
  else if(a==="refresh")refreshAll();
  else if(a==="d-add")addStudy();
  else if(a==="app-add")addApp();
  else if(a==="app-del")delDoc("apps/"+id,"application");
  else if(a==="iv-add")addInterview();
  else if(a==="iv-del")delDoc("ivs/"+id,"interview");
  else if(a==="course-add")addCourse();
  else if(a==="course-del")delDoc("courses/"+id,"course");
  else if(a==="theme")cycleTheme();
  else if(a==="homeadd")addTask();
  else if(a==="home-edit"){S.editHome=!S.editHome;render()}
  else if(a==="go-customize"){S._vAnim=true;S.view="home";S.editHome=true;render();window.scrollTo(0,0)}
  else if(a==="go-habits"){S._vAnim=true;S.view="settings";render();const h=[...document.querySelectorAll(".col h2")].find(x=>x.textContent==="Habits");if(h)h.scrollIntoView({block:"start"})}
  else if(a==="tile-up"||a==="tile-down")moveTile(id,a==="tile-up"?-1:1);
  else if(a==="tile-hide"){if(!S.ui.hidden.includes(id))S.ui.hidden.push(id);saveUI();render()}
  else if(a==="tile-show"){S.ui.hidden=S.ui.hidden.filter(x=>x!==id);saveUI();render()}
  else if(a==="tile-rename")openTileDialog("rename",id);
  else if(a==="tile-del")delTile(id);
  else if(a==="tile-new")openTileDialog("new","",el.dataset.t);
  else if(a==="cnt")bumpCustom(id,Number(el.dataset.d));
  else if(a==="t-save")tileSave();
  else if(a==="t-type"){const c=$("#card");c.dataset.ttype=el.dataset.v;el.parentNode.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b===el)))}
  else if(a==="t-color"){const c=$("#card");c.dataset.color=el.dataset.v;el.parentNode.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b===el)))}
  else if(a==="accent"){S.ui.accent=el.dataset.v;saveUI();applyUI();render()}
  else if(a==="density"){S.ui.density=el.dataset.v;saveUI();applyUI();render()}
  else if(a==="setmode"){S.theme=el.dataset.v;try{localStorage.setItem("daybook_theme",S.theme)}catch(_){}applyTheme();render()}
  else if(a==="addto"){S.ui.addTo=el.dataset.v;saveUI();render()}
  else if(a==="mod-job"){S.ui.modules.job=el.dataset.v==="1";if(!S.ui.modules.job&&S.view==="pipeline")S.view="home";saveUI();render()}
  else if(a==="mod-learn"){S.ui.modules.learn=el.dataset.v==="1";if(!S.ui.modules.learn&&S.view==="learn")S.view="home";saveUI();render()}
  else if(a==="mascot-on"){S.ui.mascot.on=el.dataset.v==="1";saveUI();render()}
  else if(a==="mascot-col"){S.ui.mascot.colour=el.dataset.v;saveUI();render()}
  else if(a==="homeday"){S._vAnim=true;S.view="today";S.day=el.dataset.v===today()?null:el.dataset.v;render();window.scrollTo(0,0)}
  else if(a==="hab-new")openHabitDialog("");
  else if(a==="hab-edit")openHabitDialog(id);
  else if(a==="h-mode"){const c=$("#card");c.dataset.hmode=el.dataset.v;el.parentNode.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b===el)));const g=document.getElementById("hGoalFld");if(g)g.hidden=el.dataset.v!=="weekly"}
  else if(a==="h-save")habitSave();
  else if(a==="h-del")habitDelete();
  else if(a==="demo-load")seedDemo();
  else if(a==="demo-skip"){clearDemo(true).then(()=>{try{localStorage.setItem("daybook_seen","1")}catch(_){}S.firstRun=false;render()})}
  else if(a==="starter")applyStarter(id);
  else if(a==="demo-clear")clearDemo();
  else if(a==="data-export")exportBackup();
  else if(a==="data-wipe"){if(S._wipe){S._wipe=false;S.db.clearAll();S.ui=defUI();saveUI();applyUI();toast("All data erased");render()}else{S._wipe=true;render();setTimeout(()=>{if(S._wipe){S._wipe=false;render()}},5000)}}
  else if(a==="card"){openCard(el.dataset.key,false)}
  else if(a==="menu"){e.stopPropagation();const r=el.getBoundingClientRect();if(!$("#menu").hidden&&menuKey===el.dataset.key){closeMenu(true);return}openMenu(el.dataset.key,r.right-200,r.bottom+4,el)}
  else if(a.startsWith("m-"))menuAction(a);
  else if(a==="c-close")$("#card").close();
  else if(a==="c-learn"){$("#card").close();toggleStudy($("#card").dataset.id)}
  else if(a==="c-study-del"){const sid=$("#card").dataset.id;$("#card").close();delDoc("study/"+sid,"study task")}
  else if(a==="c-save")saveCard();
  else if(a==="c-rsave"){const c=$("#card"),rid=c.dataset.id,n=$("#cName").value.trim();c.close();const patch={area:c.dataset.area};if(n)patch.name=n;updateRecur(rid,patch,"Saved")}
  else if(a==="c-stop"){const rid=$("#card").dataset.id;$("#card").close();stopRecur(rid)}
  else if(a==="c-del"){const tid=$("#card").dataset.id;$("#card").close();deleteTask(tid)}
  else if(a==="c-delany"){const k=$("#card").dataset.key;$("#card").close();removeAny(k)}
  else if(a==="c-area"||a==="c-prio"){const c=$("#card");c.dataset[a==="c-area"?"area":"prio"]=el.dataset.v;el.parentNode.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b===el)))}
  else if(a==="hab")setHabit(el.dataset.k,el.dataset.v==="1");
  else if(a==="c-quick"){const c=$("#card"),key=c.dataset.key,kid=key.slice(key.indexOf(":")+1);c.close();markAuto(kid,!S.autodone[kid])}
});
document.addEventListener("keydown",e=>{
  const tid=e.target&&e.target.id;
  if(e.key==="Enter"&&tid==="addInput"){e.preventDefault();addTask();return}
  if(e.key==="Enter"&&tid==="tName"){e.preventDefault();tileSave();return}
  if(e.key==="Enter"&&tid==="hName"){e.preventDefault();habitSave();return}
  if(e.key==="Enter"&&tid==="cName"){e.preventDefault();if($("#card").dataset.kind==="recur")$("[data-act=c-rsave]").click();else saveCard();return}
  if((e.key==="Delete"||e.key==="Backspace")&&e.target&&e.target.closest&&!e.target.closest("input,textarea,dialog")){const row=e.target.closest(".row[data-key]");if(row){e.preventDefault();removeAny(row.dataset.key);return}}
  const m=$("#menu");if(!m.hidden){
    if(e.key==="Escape"){e.preventDefault();closeMenu(true);return}
    if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();const it=[...m.querySelectorAll("button,a")];const i=it.indexOf(document.activeElement);const n=e.key==="ArrowDown"?(i+1)%it.length:(i-1+it.length)%it.length;it[n].focus()}
    if(e.key==="Tab")closeMenu(false);
  }
});
document.addEventListener("change",e=>{
  const t=e.target;if(!t)return;
  if(t.dataset&&t.dataset.plug){const pl=plugin(t.dataset.plug);if(pl&&pl.onChange){try{pl.onChange(e,API)}catch(err){console.error(err);toast("That plug-in hit a problem.")}}return}
  if(t.id==="dayPick"&&t.value){S.day=t.value===today()?null:t.value;render();return}
  if(t.id==="applyGoal"){S.ui.applyGoal=Math.max(1,Number(t.value)||2);saveUI();render();return}
  if(t.id==="importFile"){importBackup(t.files&&t.files[0]);t.value="";return}
  if(t.dataset&&t.dataset.app){S.db.doc("apps/"+t.dataset.app).update({status:t.value});return}
});
document.addEventListener("keydown",e=>{
  if(S.view!=="today"||e.altKey||e.ctrlKey||e.metaKey)return;
  if(e.target&&e.target.closest&&e.target.closest("input,textarea,select,dialog,#menu"))return;
  if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();const d=addDays(S.day||today(),e.key==="ArrowLeft"?-1:1);S.day=d===today()?null:d;render()}
  else if(e.key==="t"||e.key==="T"){S.day=null;render()}
});
document.addEventListener("contextmenu",e=>{
  const row=e.target.closest(".row[data-key]");if(!row||e.target.closest("a[href]"))return;
  e.preventDefault();let x=e.clientX,y=e.clientY;if(!x&&!y){const r=row.getBoundingClientRect();x=r.left+40;y=r.bottom}
  openMenu(row.dataset.key,x,y,row.querySelector(".mbtn"));
});
let lpT=null,lpXY=null;
document.addEventListener("touchstart",e=>{const row=e.target.closest(".row[data-key]");if(!row||e.target.closest("button.chk,button.play,button.mbtn"))return;const t=e.touches[0];lpXY=[t.clientX,t.clientY];clearTimeout(lpT);lpT=setTimeout(()=>{openMenu(row.dataset.key,lpXY[0],lpXY[1],row.querySelector(".mbtn"));if(navigator.vibrate)navigator.vibrate(10)},550)},{passive:true});
["touchend","touchmove","touchcancel"].forEach(t=>document.addEventListener(t,()=>clearTimeout(lpT),{passive:true}));
window.addEventListener("scroll",()=>closeMenu(false),{passive:true});
window.addEventListener("resize",()=>closeMenu(false));
setInterval(tick,1000);
setInterval(()=>{habitReminders();if((S.view==="home"||(S.view==="today"&&!S.day))&&!document.querySelector("dialog[open]")&&!(document.activeElement&&document.activeElement.closest&&document.activeElement.closest("input,textarea,select")))render()},30000);
["pointerdown","keydown"].forEach(t=>document.addEventListener(t,()=>unlockAudio(),{passive:true}));
setInterval(()=>{if(!document.hidden)Daybook.plugins.forEach(p=>{try{p.sync&&p.sync(API)}catch(_){}})},300000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden){try{if(actx&&actx.state==="suspended")actx.resume()}catch(_){}tick()}});
setInterval(()=>{if(S._day!==today()){S._day=today();render()}},60000);S._day=today();

/* ---------- boot ---------- */
function boot(){
  S.db=new LocalDB();
  S.db.onError=()=>toast("Browser storage is full. Export a backup in Settings.");
  const empty=!Object.keys(S.db.data).some(c=>Object.keys(S.db.data[c]).length);
  let seen=false;try{seen=!!localStorage.getItem("daybook_seen")}catch(_){}
  S.firstRun=!seen;
  applyTheme();applyUI();
  startData();
  if(S.firstRun&&empty)seedDemo(true);
  Daybook.plugins.forEach(p=>{try{p.init&&p.init(API)}catch(err){console.error("plug-in "+p.id,err)}});
  render();armTimer();
  try{if("serviceWorker" in navigator&&/^https?:/.test(location.protocol))navigator.serviceWorker.register("../sw.js").catch(()=>{})}catch(_){}
}
if(document.readyState==="complete")boot();else window.addEventListener("load",boot);
})();
