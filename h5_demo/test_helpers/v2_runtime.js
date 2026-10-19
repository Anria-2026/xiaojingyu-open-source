"use strict";
const fs=require("fs"),path=require("path"),{JSDOM}=require("jsdom");
const root=path.resolve(__dirname,".."),html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const scripts=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)].map(m=>m[1].split("?")[0]).filter(src=>!/^(https?:)?\/\//.test(src));
if(!scripts.includes('js/features/life_timeline.js'))scripts.splice(Math.max(0,scripts.indexOf('js/features/life_finale.js')),0,'js/features/life_timeline.js');
const extensions=scripts.filter(src=>src.startsWith("js/features/")||/^js\/(game_bus|arcade_loader|arcade_glue)\.js$/.test(src));
function runtime(omitted=[]){
  const dom=new JSDOM(html,{url:"http://localhost/",runScripts:"outside-only",pretendToBeVisual:true});
  const w=dom.window,errors=[],timeouts=[],skip=new Set(omitted);let seed=617,timer=0,current=null;
  w.__GAMEBUS_NO_TIMER=true;
  w.Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  w.Date.now=()=>1700000000000;
  w.setTimeout=(fn,delay)=>{const id=++timer;timeouts.push({fn,delay,id});return id;};
  w.clearTimeout=id=>{const i=timeouts.findIndex(t=>t.id===id);if(i>=0)timeouts.splice(i,1);};
  w.setInterval=w.requestAnimationFrame=()=>++timer;w.clearInterval=w.cancelAnimationFrame=()=>{};
  Object.defineProperties(w.HTMLImageElement.prototype,{complete:{configurable:true,get:()=>true},naturalWidth:{configurable:true,get:()=>1024},naturalHeight:{configurable:true,get:()=>768}});
  w.HTMLCanvasElement.prototype.getContext=()=>null;
  w.HTMLMediaElement.prototype.play=()=>Promise.resolve();w.HTMLMediaElement.prototype.pause=()=>{};
  w.console.error=(...args)=>errors.push(args.join(" "));
  w.addEventListener=((add)=>(type,...args)=>{if(type!=="DOMContentLoaded"&&type!=="load")add(type,...args);})(w.addEventListener.bind(w));
  Object.defineProperty(w.document,"currentScript",{configurable:true,get:()=>current});
  try{
    for(const src of scripts){if(skip.has(src))continue;current=w.document.createElement("script");current.src="http://localhost/"+src;w.eval(fs.readFileSync(path.join(root,src),"utf8"));}
    const cfg=w.GameCfg,core=w.GameCore,ui=w.GameUI;
    cfg.applyExternalCfg(JSON.parse(fs.readFileSync(path.join(root,"data/game_cfg.json"),"utf8")));
    ui.init(core,w.GameSave);core.init(cfg);ui.launch();
    return{dom,w,core,ui,errors,timeouts,close:()=>dom.window.close()};
  }catch(e){dom.window.close();throw e;}
}
module.exports={runtime,scripts,extensions,root};
