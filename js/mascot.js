/*
 * Page, the Daybook mascot.
 * Pure drawing code, shared by the app and the landing page. It returns SVG strings.
 *
 *   DaybookMascot.page({ m, hat, eyes, mouth, tie, drop, conf, zz }, size, className, { accent, status })
 *   DaybookMascot.logo(size)
 *
 * m is the mood colour: "idle", "pending", "overdue", "done", "focus" or "night".
 * accent is the body colour used for "idle" (and for every mood when status is false).
 */
(function () {
"use strict";
const PAGE_COL={pending:["#EF9F27","#BA7517"],overdue:["#E24B4A","#A32D2D"],done:["#639922","#3B6D11"],focus:["#7F77DD","#534AB7"],night:["#3C3489","#26215C"]};
function hexRGB(h){h=h.replace("#","");return [0,2,4].map(i=>parseInt(h.substr(i,2),16))}
function shade(h,f){return "#"+hexRGB(h).map(v=>("0"+Math.round(v*f).toString(16)).slice(-2)).join("")}
function lumOf(h){const c=hexRGB(h).map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]}
const PR=l=>l.map(x=>'<rect x="'+(x[0]-1)+'" y="'+(x[1]-1)+'" width="'+(x[2]+2)+'" height="'+(x[3]+2)+'" fill="#2C2C2A"/>').join("")+l.map(x=>'<rect x="'+x[0]+'" y="'+x[1]+'" width="'+x[2]+'" height="'+x[3]+'" fill="'+x[4]+'"/>').join("");
const PRF=(x,y,w,h,f)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+f+'"/>';
const PAGE_HATS={
  beanie:[[24,18,48,12,"#FAEEDA"],[22,26,52,6,"#D3D1C7"],[42,10,12,10,"#FFFFFF"]],
  party:[[44,0,8,6,"#FAC775"],[44,6,8,6,"#D4537E"],[40,12,16,6,"#FBEAF0"],[36,18,24,6,"#D4537E"],[32,24,32,6,"#FBEAF0"]],
  phones:[[24,22,62,5,"#444441"],[20,27,5,26,"#444441"],[85,27,5,26,"#444441"],[12,50,12,18,"#2C2C2A"],[86,50,12,18,"#2C2C2A"]],
  night:[[26,18,44,10,"#AFA9EC"],[66,12,12,8,"#AFA9EC"],[74,8,8,8,"#AFA9EC"],[78,2,10,10,"#EEEDFE"]],
  grad:[[22,20,66,6,"#444441"],[38,26,34,8,"#5F5E5A"],[84,20,4,18,"#EF9F27"],[82,36,8,5,"#EF9F27"]],
  crown:[[34,16,6,12,"#EF9F27"],[46,10,6,18,"#EF9F27"],[58,16,6,12,"#EF9F27"],[34,24,36,6,"#FAC775"]]
};
function page(o,size,cls,opt){
  o=o||{};size=size||96;opt=opt||{};
  const acc=opt.accent||"#2f4fc4";
  let b=acc,d=shade(acc,0.72);
  if(!o.logo&&opt.status!==false&&PAGE_COL[o.m]){b=PAGE_COL[o.m][0];d=PAGE_COL[o.m][1]}
  const e=lumOf(b)<0.18?"#FFFFFF":"#1a1a1a";
  let g=PR([[76,16,8,20,"#FAEEDA"],[76,32,8,4,"#D3D1C7"]]);
  g+=PRF(20,28,70,66,b)+PRF(20,28,10,66,d);
  if(o.hat!=="phones")g+=PRF(10,56,10,10,d)+PRF(90,56,10,10,d);
  g+=PRF(34,94,12,10,d)+PRF(64,94,12,10,d);
  if(o.hat&&PAGE_HATS[o.hat])g+=PR(PAGE_HATS[o.hat]);
  const E=(x,y,w,h)=>PRF(x,y,w,h,e);
  if(o.eyes==="happy")g+=[42,66].map(x=>E(x,54,4,4)+E(x+3,50,4,4)+E(x+7,54,4,4)).join("");
  else if(o.eyes==="sleep")g+=E(42,56,10,3)+E(66,56,10,3);
  else if(o.eyes==="focus")g+='<g class="eyes">'+E(42,50,10,10)+E(66,50,10,10)+'</g>'+E(40,44,14,3)+E(64,44,14,3);
  else if(o.eyes==="worry")g+='<g class="eyes">'+E(42,52,10,10)+E(66,52,10,10)+'</g>'+E(40,48,6,3)+E(46,45,8,3)+E(64,45,8,3)+E(72,48,6,3);
  else g+='<g class="eyes">'+E(42,50,10,10)+E(66,50,10,10)+'</g>';
  if(o.mouth==="grin")g+=E(48,66,22,8);
  else if(o.mouth==="worry")g+=E(52,72,14,3)+E(48,75,4,3)+E(66,75,4,3);
  else if(o.mouth==="flat")g+=E(52,72,14,3);
  else if(o.mouth==="sleep")g+=E(54,70,10,3);
  else g+=E(50,70,18,4)+E(46,67,4,4)+E(68,67,4,4);
  if(o.tie)g+=PR([[50,84,8,8,"#D4537E"],[40,82,10,12,"#D4537E"],[58,82,10,12,"#D4537E"]]);
  if(o.drop)g+=PRF(82,40,5,8,"#85B7EB");
  if(o.conf)g+=PRF(4,30,5,5,"#D4537E")+PRF(104,24,5,5,"#378ADD")+PRF(98,6,5,5,"#EF9F27")+PRF(8,8,5,5,"#1D9E75")+PRF(108,60,5,5,"#D4537E")+PRF(2,70,5,5,"#EF9F27");
  if(o.zz)g+='<text x="94" y="22" font-size="14" fill="currentColor" opacity=".6">z</text><text x="104" y="10" font-size="10" fill="currentColor" opacity=".6">z</text>';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 112" width="'+size+'" height="'+Math.round(size*112/120)+'"'+(cls?' class="'+cls+'"':"")+' aria-hidden="true">'+g+'</svg>';
}

/* The logo: Page in a cowboy hat. */
function logo(size){
  size=size||34;const b="#FFD60A",d="#C79A00",e="#1a1a1a";
  let g=PR([[80,116,8,12,"#FAEEDA"]])+PRF(20,50,70,66,b)+PRF(20,50,10,66,d)+PRF(10,78,10,10,d)+PRF(90,78,10,10,d)+PRF(34,116,12,10,d)+PRF(64,116,12,10,d);
  g+=PRF(42,72,10,10,e)+PRF(66,72,10,10,e)+PRF(50,92,18,4,e)+PRF(46,89,4,4,e)+PRF(68,89,4,4,e)+PRF(34,88,6,4,"#FF9EC4")+PRF(80,88,6,4,"#FF9EC4");
  g+=PR([[38,24,34,20,"#B8763A"],[48,20,14,4,"#B8763A"],[38,38,34,5,"#FF2D95"],[6,43,98,7,"#8B5A2B"],[2,38,10,6,"#8B5A2B"],[98,38,10,6,"#8B5A2B"]]);
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 128" width="'+size+'" height="'+Math.round(size*128/120)+'" aria-hidden="true">'+g+'</svg>';
}
window.DaybookMascot = { page: page, logo: logo };
})();
