/* Generated layout fallbacks stay inside capability guards; shipping CSS remains authoritative. */
'use strict';
const crypto=require('crypto');
function split(value,comma=false){const out=[];let part='',depth=0;for(const ch of value){if(ch==='(')depth++;if(ch===')')depth--;if(depth===0&&(comma?ch===',':/\s/.test(ch))){if(part.trim())out.push(part.trim());part='';}else part+=ch;}if(part.trim())out.push(part.trim());return out;}
function args(value,name){if(!value.startsWith(name+'(')||!value.endsWith(')'))return null;const body=value.slice(name.length+1,-1);let depth=0;for(const ch of body){if(ch==='(')depth++;if(ch===')')depth--;if(depth<0)return null;}return depth===0?split(body,true):null;}
function plain(value){
  value=value.replace(/(-?(?:\d+(?:\.\d*)?|\.\d+))[dls]v([wh])/g,"$1v$2");
  let previous;do{previous=value;value=value.replace(/env\([^()]*?(?:,\s*([^()]+))?\)/g,(m,f)=>f?f.trim():'0px');}while(value!==previous);
  value=value.replace(/(?:min|max|clamp)\([^()]*\)/g,m=>{const name=m.slice(0,m.indexOf('(')),a=args(m,name);if(!a)return m;const numbers=a.map(x=>/^(-?[\d.]+)([a-z%]*)$/.exec(x));if(numbers.every(Boolean)&&numbers.every(x=>x[2]===numbers[0][2])){const ns=numbers.map(x=>Number(x[1])),n=name==='min'?Math.min(...ns):name==='max'?Math.max(...ns):Math.max(ns[0],Math.min(ns[1],ns[2]));return n+numbers[0][2];}return name==='clamp'?a[1]:a[0];});
  return value;
}
function fallback(property,value,css,valueAst){
  const p=property.toLowerCase(),v=value.trim(),axis=/^(?:min-|max-)?(width|height)$/.exec(p),normal=axis&&axis[1];
  for(const name of ['min','max','clamp']){
    const raw=args(v,name);if(!raw)continue;const a=raw.map(plain);
    if((p==='width'||p==='height')&&name==='clamp'&&a.length===3)return p+':'+a[1]+';min-'+normal+':'+a[0]+';max-'+normal+':'+a[2]+';';
    const fluid=a.find(x=>/%|\bv[wh]\b|calc\(/.test(x))||a[a.length-1],cap=a.find(x=>x!==fluid)||fluid;
    if((p==='width'||p==='height')&&name==='min')return p+':'+fluid+';max-'+normal+':'+cap+';';
    if((p==='width'||p==='height')&&name==='max')return p+':'+fluid+';min-'+normal+':'+cap+';';
    if(axis&&(p.startsWith('max-')||p.startsWith('min-')))return p+':'+(name==='clamp'?a[1]:fluid)+';';
    return p+':'+plain(v)+';';
  }
  if(p==='inset'){
    if(!css)throw new Error('Inset fallback requires the CSS value lexer');
    const ast=valueAst||css.parse(v,{context:'value'}),q=[];
    // Canonical CSS may concatenate adjacent percentage/identifier tokens.
    // Top-level AST nodes preserve value boundaries and keep calc/var intact.
    ast.children.forEach(node=>{if(node.type!=='WhiteSpace')q.push(plain(css.generate(node)));});
    if(q.length<1||q.length>4)throw new Error('Unsupported inset shape '+v);
    return 'top:'+q[0]+';right:'+(q[1]||q[0])+';bottom:'+(q[2]||q[0])+';left:'+(q[3]||q[1]||q[0])+';';
  }
  if(/\b(?:min|max|clamp|env)\(/.test(v)){const alternative=plain(v);if(alternative!==v&&!/\b(?:min|max|clamp|env)\(/.test(alternative))return p+':'+alternative+';';}
  if(p==='gap'||p==='row-gap'||p==='column-gap')return 'grid-'+p+':'+v+';';
  return '';
}
const guards={math:'not (width:min(1px,2px))',inset:'not (inset:0)',env:'not (padding:env(safe-area-inset-top))',gap:'not (gap:1px)',viewport:'not (height:1dvh)'};
function hasSelectors(selector,mappings){
  let changed=false;
  const converted=selector.replace(/:has\(([^()]*)\)/g,(all,condition,at)=>{
    condition=condition.trim();
    // This closure uses descendant compound, attribute and comma-list conditions. Relative/nested pseudo conditions require an explicit decision.
    if(!condition||/[():]/.test(condition)||/(?:^|,)\s*[>+~]/.test(condition))throw new Error('New :has condition requires an explicit legacy decision: '+condition);
    const className='whale-has-'+crypto.createHash('sha256').update(condition).digest('hex').slice(0,10);
    const target=selector.slice(0,at).replace(/:not\($/,'').trim();
    if(!target||/:has\(/.test(target))throw new Error('Unsupported nested :has selector '+selector);
    const key=target+'|'+condition;mappings.set(key,{target,condition,className});changed=true;return '.'+className;
  });
  if(selector.includes(':has(')&&!changed)throw new Error('Unparsed :has selector '+selector);
  return changed?'html.whale-legacy-has '+converted:null;
}
function transform(source,css){
  const ast=css.parse(source,{positions:true}),patches=new Map(),mappings=new Map(),states=new Map(),affected={math:new Set(),inset:new Set(),env:new Set(),gap:new Set(),viewport:new Set(),has:new Set()};let count=0;
  function group(p,v){return p==='inset'?'inset':/^(?:row-|column-)?gap$/.test(p)?'gap':/\b(?:min|max|clamp)\(/.test(v)?'math':'env';}
  function belongs(p,set){
    if(set.has(p))return true;
    const family=/^(?:min-|max-)?(width|height)$/.exec(p);if(family)return [...set].some(x=>new RegExp('^(?:min-|max-)?'+family[1]+'$').test(x));
    for(const name of ['padding','margin','font','gap'])if(p===name||p.startsWith(name+'-'))return [...set].some(x=>x===name||x.startsWith(name+'-'));
    return false;
  }
  // Copy authored overrides for every affected property family, so appending a patch never reorders its cascade.
  css.walk(ast,{visit:'Rule',enter(node){
    if(!node.prelude||node.prelude.type!=='SelectorList')return;
    const has=css.generate(node.prelude).includes(':has(');
    node.block.children.forEach(d=>{
      if(d.type!=='Declaration'||d.property.startsWith('--'))return;
      const p=d.property.toLowerCase(),v=css.generate(d.value),extra=fallback(p,v,css,d.value);
      if(has)affected.has.add(p);
      if(extra){const target=affected[group(p,v)];target.add(p);css.parse(extra,{context:'declarationList'}).children.forEach(x=>{if(x.type==='Declaration')target.add(x.property);});}
      if(/[\d.][dls]v[wh]\b/.test(v))affected.viewport.add(p);
    });
  }});
  css.walk(ast,{visit:'Rule',enter(node){
    if(!node.prelude||node.prelude.type!=='SelectorList')return;
    const selectors=[];node.prelude.children.forEach(s=>selectors.push(css.generate(s)));
    const declarations=[];node.block.children.forEach(d=>{if(d.type==='Declaration')declarations.push({property:d.property,value:css.generate(d.value),valueAst:d.value,important:d.important});});
    let added='';
    for(const selector of selectors){
      const converted=hasSelectors(selector,mappings);
      const hasText=declarations.filter(d=>converted||belongs(d.property.toLowerCase(),affected.has)).map(d=>d.property+':'+d.value+(d.important?'!important':'')+';').join('');
      const hasVariant=converted||'html.whale-legacy-has '+selector;
      const state=states.get(selector)||{authored:{},synthetic:new Set()},groups={math:'',inset:'',env:'',gap:'',viewport:''};
      for(const d of declarations){
        const p=d.property.toLowerCase(),v=d.value,important=d.important?'!important':'',original=p+':'+v+important+';';
        if(p.startsWith('--'))continue;
        if(/^(?:min-|max-)(?:width|height)$/.test(p)){
          state.authored[p]={value:v,important};
          if(state.synthetic.has(p)){groups.math+=p+':'+(fallback(p,v,css,d.valueAst)?plain(v):v)+important+';';state.synthetic.delete(p);}
        }
        if((p==='width'||p==='height')&&!/\b(?:min|max|clamp)\(/.test(v)){
          for(const bound of ['min-'+p,'max-'+p])if(state.synthetic.has(bound)){
            const own=declarations.find(x=>x.property===bound),prior=state.authored[bound],value=own?own.value:prior?prior.value:bound.startsWith('min-')?'0':'none';
            groups.math+=bound+':'+plain(value)+(own&&own.important||prior&&prior.important||important)+';';state.synthetic.delete(bound);
          }
        }
        let extra=fallback(p,v,css,d.valueAst);
        if(extra){
          if(d.important)extra=extra.replace(/;/g,'!important;');
          const kind=group(p,v);groups[kind]+=extra;count++;
          if((p==='width'||p==='height')&&kind==='math')for(const bound of ['min-'+p,'max-'+p])if(extra.includes(bound+':')&&!declarations.some(x=>x.property===bound))state.synthetic.add(bound);
        }
        if(/[\d.][dls]v[wh]\b/.test(v))groups.viewport+=p+':'+v.replace(/(-?(?:\d+(?:\.\d*)?|\.\d+))[dls]v([wh])/g,'$1v$2')+important+';';
        for(const kind of Object.keys(groups))if(belongs(p,affected[kind]))groups[kind]+=original;
      }
      states.set(selector,state);
      // The :has emulation adds an html prefix to every affected authored
      // property family. Other capability fallbacks must share that specificity
      // and follow the authored copy, or an earlier 58px event dot wins over
      // the later min()/max() expansion when both capabilities are absent.
      if(hasText)added+=hasVariant+'{'+hasText+'}';
      for(const [kind,text]of Object.entries(groups))if(text){
        added+='@supports '+guards[kind]+'{'+selector+'{'+text+'}}';
        // Only a real :has selector needs all declarations at the emulated
        // specificity. Ordinary selectors mirror just the affected families;
        // promoting an unrelated clamp(letter-spacing) would incorrectly beat
        // a later authored letter-spacing override.
        const prefixed=converted?text:css.parse(text,{context:'declarationList'}).children.toArray().filter(d=>d.type==='Declaration'&&belongs(d.property.toLowerCase(),affected.has)).map(d=>css.generate(d)).join(';');
        if(prefixed)added+='@supports '+guards[kind]+'{'+hasVariant+'{'+prefixed+'}}';
      }
    }
    patches.set(node.loc.start.offset,added);
  }});
  function render(block){
    let out='';
    block.children.forEach(node=>{
      if(node.type==='Rule')out+=patches.get(node.loc.start.offset)||'';
      else if(node.type==='Atrule'&&node.block&&!/keyframes$|font-face$/.test(node.name)){
        const child=render(node.block);if(child)out+='@'+node.name+(node.prelude?' '+css.generate(node.prelude):'')+'{'+child+'}';
      }
    });return out;
  }
  const code='/* Generated legacy capability patch; original CSS is imported by the builder. */\n'+css.generate(css.parse(render(ast)))+'\n';
  return {code,fallbackDeclarations:count,hasMappings:[...mappings.values()]};
}
module.exports={transform,fallback,plain,split};
