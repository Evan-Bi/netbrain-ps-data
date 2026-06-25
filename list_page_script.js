/**
 * NetBrain Priority Score Injector — List Page
 * Hosted at: https://github.com/Evan-Bi/netbrain-ps-data/blob/main/list_page_script.js
 * Served via: https://cdn.jsdelivr.net/gh/Evan-Bi/netbrain-ps-data@main/list_page_script.js
 *
 * To deploy changes: push this file to GitHub. jsDelivr CDN picks it up automatically.
 * No InSided admin changes needed.
 *
 * How it works:
 *   1. Runs only on /ideas (list page)
 *   2. Reads score map from sessionStorage or fetches from GitHub JSON
 *   3. Injects a score block BELOW the vote button on each idea card
 *      using a position:fixed overlay div (no id) appended to document.body
 *   4. MutationObserver re-injects when InSided SPA re-renders cards
 *   5. ov() checks document.body.contains(_ov) — if Preact hydration detaches
 *      our container, it is recreated transparently (root cause fix)
 *   6. Capture-phase click listener provides optimistic score update on vote
 *
 * Score data:
 *   https://raw.githubusercontent.com/Evan-Bi/netbrain-ps-data/main/ps_scores.json
 *   Format: { "topicId": score }  e.g. { "100": 20 }
 *
 * Colour tiers:
 *   score >= 70  → orange  #E65100
 *   score >= 40  → amber   #F9A825
 *   score  < 40  → blue    #1565C0
 *
 * Tier vote weights:  Tier 0=30, Tier 1=20, Tier 2=10, Tier 3=10, unknown=10
 * sessionStorage TTL: 15 minutes
 */
(function(){
"use strict";
if(window.location.pathname!=="/ideas")return;
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

// -- Overlay container
// No id: avoids conflicts with InSided's own elements.
// Checks document.body.contains(_ov) each call: Preact hydration may detach
// our container. If detached, recreate it and clear _bl so inj() rebuilds all
// score blocks into the fresh container.
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
// preact_voted present = already voted (click = unvote)
// preact_voted absent  = not voted   (click = vote)
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
  var tm=role?role.match(/Tier\s*([0-9]+)/i):null;
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

// -- Boot
var cv=sr();if(cv){_m=cv.map;_t=cv.ts;}

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

})();
