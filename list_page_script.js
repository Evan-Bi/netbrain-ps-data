/**
 * NetBrain Priority Score Injector â List Page + Details Page
 * Hosted at: https://github.com/Evan-Bi/netbrain-ps-data/blob/main/list_page_script.js
 * Served via: https://cdn.jsdelivr.net/gh/Evan-Bi/netbrain-ps-data@main/list_page_script.js
 *
 * To deploy changes: push this file to GitHub (reference copy).
 * Admin bodyEnd has the full script â update via InSided admin UI to go live.
 *
 * How it works:
 *   LIST PAGE (/ideas):
 *   1. Reads score map from sessionStorage or fetches from GitHub JSON
 *   2. Injects a score block BELOW the vote button on each idea card
 *      using a position:fixed overlay div appended to document.body
 *   3. MutationObserver re-injects when InSided SPA re-renders cards
 *   4. ov() checks document.body.contains(_ov) â recreates if detached
 *   5. Capture-phase click listener: optimistic score update on vote
 *
 *   DETAILS PAGE (/ideas/xxx-yyy-zzz-NNN):
 *   1. injDetails(): appends inline PS badge inside .ideation-topic-votes-wrapper
 *      (appears after the vote button and voter avatars, same row â flex layout)
 *   2. Capture-phase click listener: optimistic score update for inline badge
 *   3. Existing right-side widget (if present) is untouched
 *
 * Score data:
 *   https://raw.githubusercontent.com/Evan-Bi/netbrain-ps-data/main/ps_scores.json
 *   Format: { "topicId": score }  e.g. { "100": 20 }
 *
 * Colour tiers:
 *   score >= 70  â orange  #E65100
 *   score >= 40  â amber   #F9A825
 *   score  < 40  â blue    #1565C0
 *
 * Tier vote weights:  Tier 0=30, Tier 1=20, Tier 2=10, Tier 3=10, unknown=10
 * sessionStorage TTL: 15 minutes
 *
 * â ï¸ InSided strips ALL backslashes on save.
 *    Use [0-9] not \d, [ ]* not \s*, [A-Za-z0-9_] not \w â everywhere.
 */
(function(){
"use strict";
var _p=window.location.pathname;
var _isList=(_p==="/ideas");
var _isDetails=(_p.indexOf("/ideas/")===0&&_p.length>7);
if(!_isList&&!_isDetails)return;

var U="https://raw.githubusercontent.com/Evan-Bi/netbrain-ps-data/main/ps_scores.json";
var SM="nb_ps_map",ST="nb_ps_ts",TTL=900000;
var _m=null,_t=0;

// -- Colour helper
function col(s){
  if(s>=70)return{bg:"#E65100",tx:"#FFFFFF"};
  if(s>=40)return{bg:"#F9A825",tx:"#FFFFFF"};
  return{bg:"#1565C0",tx:"#FFFFFF"};
}

// -- Tier vote weights
var TW={0:30,1:20,2:10,3:10};
var DW=10;

// -- sessionStorage helpers
function sr(){
  try{
    var r=sessionStorage.getItem(SM),t=parseInt(sessionStorage.getItem(ST)||"0",10);
    if(r&&t)return{map:JSON.parse(r),ts:t};
  }catch(e){}
  return null;
}
function sw(m){
  try{
    sessionStorage.setItem(SM,JSON.stringify(m));
    sessionStorage.setItem(ST,String(Date.now()));
  }catch(e){}
}

// -- Fetch score map (memory -> sessionStorage -> GitHub)
function fsm(){
  var n=Date.now();
  if(_m&&n-_t<TTL)return Promise.resolve(_m);
  var c=sr();
  if(c&&n-c.ts<TTL){_m=c.map;_t=c.ts;return Promise.resolve(_m);}
  return fetch(U)
    .then(function(r){return r.json();})
    .then(function(d){
      var mp={};
      Object.keys(d).forEach(function(k){mp[parseInt(k,10)]=d[k];});
      _m=mp;_t=Date.now();sw(mp);return mp;
    })
    .catch(function(){return _m||{};});
}

// -- Shared cache warm-up (runs on both page types)
var _cv=sr();if(_cv){_m=_cv.map;_t=_cv.ts;}

// ==================== LIST PAGE ====================
if(_isList){

// -- Overlay container (position:fixed, appended to body)
var _ov=null;
function ov(){
  if(!_ov||!document.body.contains(_ov)){
    _ov=document.createElement("div");
    _ov.style.cssText="position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;z-index:99999;";
    document.body.appendChild(_ov);
    _bl={};
  }
  return _ov;
}

// -- Block registry: { ideaId -> { el, btn } }
var _bl={};

// -- Reposition all blocks on scroll/resize
function upos(){
  Object.keys(_bl).forEach(function(id){
    var info=_bl[id];
    if(!document.body.contains(info.btn)){info.el.remove();delete _bl[id];return;}
    var br=info.btn.getBoundingClientRect();
    if(br.width===0){info.el.style.display="none";return;}
    info.el.style.display="";
    info.el.style.right=(document.documentElement.clientWidth-br.right)+"px";
    info.el.style.top=(br.bottom+4)+"px";
  });
}

// -- Inject score blocks below vote button for all scored ideas
function inj(sm){
  var o=ov();
  var seen={};
  var cardNodes=document.querySelectorAll("div.idea-view");
  if(cardNodes.length===0){setTimeout(run,400);return;}
  var needRetry=false;
  cardNodes.forEach(function(card){
    var a=card.querySelector("a.qa-topic-title");
    if(!a)return;
    var mv=a.href.match(/-([0-9]+)$/);
    if(!mv)return;
    var id=parseInt(mv[1],10);
    var sc=sm[id];
    if(sc===undefined)return;
    var btn=card.querySelector("button.qa-topic-meta-likes-icon");
    if(!btn)return;
    var br=btn.getBoundingClientRect();
    if(br.width===0){needRetry=true;return;}
    seen[id]=true;
    if(_bl[id]&&_bl[id].btn===btn){
      _bl[id].el.style.right=(document.documentElement.clientWidth-br.right)+"px";
      _bl[id].el.style.top=(br.bottom+4)+"px";
      return;
    }
    if(_bl[id])_bl[id].el.remove();
    var cl=col(sc);
    var b=document.createElement("div");
    b.className="nb-ps-score-below";
    b.style.cssText=
      "position:fixed;pointer-events:auto;" +
      "right:"+(document.documentElement.clientWidth-br.right)+"px;" +
      "top:"+(br.bottom+4)+"px;" +
      "width:"+br.width+"px;" +
      "background:"+cl.bg+";" +
      "color:"+cl.tx+";" +
      "border-radius:4px;" +
      "padding:4px 2px;" +
      "font-size:10px;" +
      "font-weight:700;" +
      "text-align:center;" +
      "white-space:nowrap;" +
      "cursor:default;" +
      "z-index:10;" +
      "line-height:1.2;";
    b.innerHTML=sc+"<br>Points";
    o.appendChild(b);
    _bl[id]={el:b,btn:btn};
  });
  Object.keys(_bl).forEach(function(id){
    if(!seen[id]){_bl[id].el.remove();delete _bl[id];}
  });
  if(needRetry)setTimeout(run,400);
}

// -- Update a single score block (optimistic vote)
function upov(id,sc){
  if(!_bl[id])return;
  var cl=col(sc);
  _bl[id].el.style.background=cl.bg;
  _bl[id].el.style.color=cl.tx;
  _bl[id].el.innerHTML=sc+"<br>Points";
}

// -- Capture-phase click: fires BEFORE Preact handles vote
document.addEventListener("click",function(e){
  var btn=e.target.closest("button.qa-topic-meta-likes-icon");
  if(!btn)return;
  var isVoting=!btn.classList.contains("preact_voted");
  var card=btn.closest("div.idea-view");
  if(!card)return;
  var a=card.querySelector("a.qa-topic-title");
  if(!a)return;
  var mv=a.href.match(/-([0-9]+)$/);
  if(!mv)return;
  var id=parseInt(mv[1],10);
  var role=(window.inSidedData&&window.inSidedData.user)?window.inSidedData.user.role:null;
  var tm=role?role.match(/Tier[ ]*([0-9]+)/i):null;
  var tier=tm?parseInt(tm[1],10):null;
  var weight=(tier!==null&&TW[tier]!==undefined)?TW[tier]:DW;
  var delta=isVoting?weight:-weight;
  if(!_m)return;
  var cur=(_m[id]!==undefined)?_m[id]:0;
  var ns=cur+delta;
  _m[id]=ns;
  sw(_m);
  upov(id,ns);
},true);

// -- Main
function run(){fsm().then(inj);}

window.addEventListener("scroll",upos,{passive:true});
window.addEventListener("resize",upos,{passive:true});

document.addEventListener("visibilitychange",function(){
  if(document.visibilityState==="visible")run();
});
window.addEventListener("focus",run);

// -- MutationObserver: re-inject on SPA re-render
var _dt=null,_ob=false;
function obs(){
  if(_ob)return;
  _ob=true;
  new MutationObserver(function(ms){
    var rel=ms.some(function(mu){
      return Array.prototype.some.call(mu.addedNodes,function(n){
        return n.nodeType===1&&(n.classList.contains("idea-view")||n.querySelector("div.idea-view"));
      });
    });
    if(!rel)return;
    if(_dt)cancelAnimationFrame(_dt);
    _dt=requestAnimationFrame(function(){run();});
  }).observe(document.body,{childList:true,subtree:true});
}

function boot(){run();obs();}

if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",boot);
}else{
  boot();
}

// -- Retries (catch late card layout)
setTimeout(run,1500);
setTimeout(run,4000);
var _ri=0,_ric=setInterval(function(){_ri++;run();if(_ri>=4)clearInterval(_ric);},5000);

} // end if(_isList)

// ==================== DETAILS PAGE ====================
if(_isDetails){

// -- Inject inline PS badge into vote wrapper row
// .ideation-topic-votes-wrapper is display:flex flex-direction:row
// Badge appended as last flex child, same height as vote button (48px)
function injDetails(sm){
  var mv=window.location.href.match(/-([0-9]+)$/);
  if(!mv)return;
  var id=parseInt(mv[1],10);
  var sc=sm[id];
  if(sc===undefined)return;
  var wrapper=document.querySelector(".ideation-topic-votes-wrapper");
  if(!wrapper){setTimeout(function(){fsm().then(injDetails);},600);return;}
  if(wrapper.querySelector(".nb-ps-inline"))return;
  var cl=col(sc);
  var badge=document.createElement("div");
  badge.className="nb-ps-inline";
  badge.style.cssText=
    "display:flex;align-items:center;justify-content:center;flex-direction:column;" +
    "background:"+cl.bg+";color:"+cl.tx+";" +
    "border-radius:4px;padding:0 14px;font-size:11px;font-weight:700;" +
    "text-align:center;white-space:nowrap;cursor:default;line-height:1.3;" +
    "margin-left:8px;min-width:52px;";
  badge.innerHTML=
    "<span style='font-size:16px;font-weight:800;'>"+sc+"</span>" +
    "<span style='font-size:10px;opacity:0.9;'>Priority Score</span>";
  wrapper.appendChild(badge);
}

// -- Capture-phase click: optimistic update for inline badge
document.addEventListener("click",function(e){
  var btn=e.target.closest("button.qa-topic-meta-likes-icon");
  if(!btn)return;
  var isVoting=!btn.classList.contains("preact_voted");
  var mv=window.location.href.match(/-([0-9]+)$/);
  if(!mv)return;
  var id=parseInt(mv[1],10);
  var role=(window.inSidedData&&window.inSidedData.user)?window.inSidedData.user.role:null;
  var tm=role?role.match(/Tier[ ]*([0-9]+)/i):null;
  var tier=tm?parseInt(tm[1],10):null;
  var weight=(tier!==null&&TW[tier]!==undefined)?TW[tier]:DW;
  var delta=isVoting?weight:-weight;
  if(!_m)return;
  var cur=(_m[id]!==undefined)?_m[id]:0;
  var ns=cur+delta;
  _m[id]=ns;
  sw(_m);
  var badge=document.querySelector(".nb-ps-inline");
  if(badge){
    var cl=col(ns);
    badge.style.background=cl.bg;
    badge.style.color=cl.tx;
    badge.innerHTML=
      "<span style='font-size:16px;font-weight:800;'>"+ns+"</span>" +
      "<span style='font-size:10px;opacity:0.9;'>Priority Score</span>";
  }
},true);

function runD(){fsm().then(injDetails);}

if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",runD);
}else{
  runD();
}

// -- Retries for late Preact render
setTimeout(runD,1000);
setTimeout(runD,3000);

} // end if(_isDetails)

})();
