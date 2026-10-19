/* Build from the shipping script manifest: node tools/build_legacy_webview.js [--check].
   No npm/network at runtime. Reproducible fallback: npm install --prefix tools/legacy-build. */
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const arcadeClosure=require('./legacy-build/arcade_closure');
const ROOT=path.resolve(__dirname,'..'),VERSIONS=require('./legacy-build/package.json').dependencies;
const OUTPUT='h5_demo/js/legacy/game.es5.js',META='tools/legacy-build/manifest.json';
const ONLINE_TARGET_BYTES=1500000;
function sha(data){return crypto.createHash('sha256').update(data).digest('hex');}
// Repeated builds must not truncate existing Windows output files. A sibling
// temporary file also leaves the previous good output intact if writing fails.
function writeGenerated(file,content){
  const bytes=Buffer.from(content);
  if(fs.existsSync(file)&&fs.readFileSync(file).equals(bytes))return false;
  const temp=path.join(path.dirname(file),'.'+path.basename(file)+'.'+crypto.randomUUID()+'.tmp');
  try{
    fs.writeFileSync(temp,bytes,{flag:'wx'});
    fs.renameSync(temp,file);
  }finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
  return true;
}
function tool(name){
  const candidates=[path.join(__dirname,'legacy-build','node_modules',name),
    path.join(ROOT,'node_modules',name),
    path.join(process.env.APPDATA||'','npm','node_modules','vercel','node_modules',name)];
  for(const dir of candidates){try{const pkg=require(path.join(dir,'package.json'));if(pkg.version!==VERSIONS[name])continue;return require(dir);}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}}
  throw new Error('Missing fixed build-only tool '+name+'@'+VERSIONS[name]+'. Install tools/legacy-build dependencies; never ship that directory.');
}
function styleInputs(root=ROOT){
  const index=fs.readFileSync(path.join(root,'h5_demo/index.html'),'utf8');
  return [...index.matchAll(/<link[^>]*href="([^"?]+\.css)(\?[^" ]*)?"[^>]*data-boot-style/g)].map(m=>{
    const relative='h5_demo/'+m[1],source=fs.readFileSync(path.join(root,relative),'utf8');
    return {url:m[1]+(m[2]||''),path:relative,source,sha256:sha(source),output:'h5_demo/js/legacy/styles.'+m[1].replace(/[^\w.-]/g,'_')};
  });
}
function inputs(root=ROOT){
  const index=fs.readFileSync(path.join(root,'h5_demo/index.html'),'utf8');
  const manifest=(index.match(/<template id="game-script-manifest">([\s\S]*?)<\/template>/)||[])[1];
  if(!manifest)throw new Error('Shipping inert script manifest is missing');
  const list=[...manifest.matchAll(/<script\s+src="([^"]+)"[^>]*><\/script>/g)].map(m=>m[1]);
  if(!list.length||new Set(list).size!==list.length)throw new Error('Empty or duplicated source manifest');
  return list.map(url=>{
    if(!/^js\/[\w./-]+\.js\?v=[\w-]+$/.test(url)||url.includes('..')||url.includes('/legacy/'))throw new Error('Unsafe/incompatible manifest URL '+url);
    const relative='h5_demo/'+url.split('?')[0],source=fs.readFileSync(path.join(root,relative),'utf8');
    return {url,path:relative,source,sha256:sha(source)};
  });
}
function build(root=ROOT){
  const ts=tool('typescript'),esbuild=tool('esbuild'),acorn=tool('acorn'),sources=inputs(root);
  const lazyScripts=arcadeClosure.build(root,tool);
  const styles=styleInputs(root).concat(arcadeClosure.styles(root,sources)).map(input=>{const patch=require('./legacy-build/css_fallback').transform(input.source,tool('css-tree'));return {...input,...patch,code:'@import url("../../'+input.url+'");\n'+patch.code};});
  if(!styles.length)throw new Error('Legacy stylesheet closure is empty');
  const mappings=[...new Map(styles.flatMap(sheet=>sheet.hasMappings).concat(lazyScripts.flatMap(script=>script.inlineStyles.flatMap(sheet=>sheet.hasMappings))).map(item=>[item.target+'|'+item.condition,item])).values()];
  const layoutSource=fs.readFileSync(path.join(root,'tools/legacy-build/layout_runtime.js'),'utf8');
  const layout=layoutSource.replace('__WHALE_HAS_MAPPINGS__',JSON.stringify(mappings));
  acorn.parse(layout,{ecmaVersion:5});
  const merged=layout+'\n;\n'+sources.map(s=>'\n/* Source: '+s.path+' */\n'+s.source+'\n;').join('\n');
  // Do not silently ship newly introduced strong dependencies with no local fallback.
  const omitted=/\b(?:IntersectionObserver|structuredClone|queueMicrotask)\s*\(|Object\.(?:hasOwn)\s*\(|\.replaceAll\s*\(/;
  const hit=merged.match(omitted);if(hit)throw new Error('New API requires an explicit legacy decision: '+hit[0]);
  // Optional idle work already has explicit synchronous/timer branches in the development source.
  const audit=ts.createSourceFile('closure.js',merged,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  function descendant(node,ancestor){for(let p=node;p;p=p.parent)if(p===ancestor)return true;return false;}
  function inspect(node){
    if((ts.isNewExpression(node)||ts.isCallExpression(node))&&
      ((ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='ResizeObserver')||
       (ts.isIdentifier(node.expression)&&node.expression.text==='ResizeObserver'))){
      const reference=node.expression.getText(audit);
      let guarded=false;
      for(let p=node.parent;p;p=p.parent){
        if(!ts.isIfStatement(p)||!descendant(node,p.thenStatement))continue;
        const c=p.expression;
        if(ts.isBinaryExpression(c)&&ts.isTypeOfExpression(c.left)&&c.left.expression.getText(audit)===reference&&
          [ts.SyntaxKind.EqualsEqualsToken,ts.SyntaxKind.EqualsEqualsEqualsToken].includes(c.operatorToken.kind)&&
          ts.isStringLiteral(c.right)&&c.right.text==='function')guarded=true;
      }
      if(!guarded)throw new Error('New API requires an explicit legacy decision: unguarded ResizeObserver');
    }
    if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='requestIdleCallback'){
      let guarded=false;
      for(let p=node.parent;p;p=p.parent){
        if(ts.isConditionalExpression(p)&&descendant(node,p.whenTrue)&&/requestIdleCallback/.test(p.condition.getText(audit)))guarded=true;
        if(ts.isIfStatement(p)&&descendant(node,p.thenStatement)&&/typeof[\s\S]*requestIdleCallback[\s\S]*['"]function['"]/.test(p.expression.getText(audit)))guarded=true;
      }
      if(!guarded)throw new Error('Strong requestIdleCallback dependency needs an explicit legacy fallback');
    }
    ts.forEachChild(node,inspect);
  }
  inspect(audit);
  const translated=ts.transpileModule(merged,{fileName:'game.js',reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES5,module:ts.ModuleKind.CommonJS,downlevelIteration:true,removeComments:true,newLine:ts.NewLineKind.LineFeed}});
  const errors=(translated.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
  if(errors.length)throw new Error(errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join('\n'));
  const code='/* Generated by tools/build_legacy_webview.js. ES5; edit original sources. */\n'+esbuild.transformSync(translated.outputText,{minify:true,target:'es5',charset:'utf8',legalComments:'none'}).code;
  acorn.parse(code,{ecmaVersion:5,sourceType:'script'});
  const poly=fs.readFileSync(path.join(root,'h5_demo/js/legacy/polyfills.js'));
  acorn.parse(poly.toString(),{ecmaVersion:5});
  for(const id of ['boot-health','boot-compat','boot-game-route']){
    const html=fs.readFileSync(path.join(root,'h5_demo/index.html'),'utf8'),inline=(html.match(new RegExp('<script id="'+id+'">([\\s\\S]*?)<\\/script>'))||[])[1];
    if(!inline)throw new Error('Missing ES5 boot script '+id);acorn.parse(inline,{ecmaVersion:5});
  }
  const bytes=Buffer.byteLength(code)+poly.length+styles.reduce((n,s)=>n+Buffer.byteLength(s.code),0)+lazyScripts.reduce((n,s)=>n+Buffer.byteLength(s.code),0);
  const meta={schema:1,target:'ES5; capability floor CSS custom properties/flex/grid/contents, Canvas2D, SVG, ArrayBuffer/XHR, MutationObserver',tools:VERSIONS,layout:{source:'tools/legacy-build/layout_runtime.js',sha256:sha(layoutSource),hasMappings:mappings,aspectFallbacks:['.focus-quadrant','.aqua-stage']},sources:sources.map(({url,path,sha256})=>({url,path,sha256})),polyfills:{path:'h5_demo/js/legacy/polyfills.js',sha256:sha(poly),bytes:poly.length},bundle:{path:OUTPUT,sha256:sha(code),bytes:Buffer.byteLength(code)},styles:styles.map(({url,path,sha256,output,code,fallbackDeclarations})=>({url,path,sha256,output,outputSha256:sha(code),bytes:Buffer.byteLength(code),fallbackDeclarations})),compatBytes:bytes,onlineTargetCompatBytes:ONLINE_TARGET_BYTES,packageBudgetPolicy:"actual Toy directory and ZIP must separately stay within the packaging hard limit"};
  meta.lazyScripts=lazyScripts.map(({path,sha256,output,code,inlineStyles})=>({path,sha256,output,outputSha256:sha(code),bytes:Buffer.byteLength(code),inlineStyles}));
  meta.layout.aspectFallbacks.push('.awh-hammer-rig','.awh-impact');
  return {code,meta,styles,lazyScripts};
}
if(require.main===module){
  const {code,meta,styles,lazyScripts}=build(),metaText=JSON.stringify(meta,null,2)+'\n';
  if(process.argv.includes('--check')){
    if(!fs.existsSync(path.join(ROOT,OUTPUT))||fs.readFileSync(path.join(ROOT,OUTPUT),'utf8')!==code||!fs.existsSync(path.join(ROOT,META))||fs.readFileSync(path.join(ROOT,META),'utf8')!==metaText)throw new Error('Legacy generated output is stale. Run node tools/build_legacy_webview.js');
    for(const sheet of styles)if(!fs.existsSync(path.join(ROOT,sheet.output))||fs.readFileSync(path.join(ROOT,sheet.output),'utf8')!==sheet.code)throw new Error('Legacy stylesheet is stale: '+sheet.output);
    for(const script of lazyScripts)if(!fs.existsSync(path.join(ROOT,script.output))||fs.readFileSync(path.join(ROOT,script.output),'utf8')!==script.code)throw new Error('Legacy lazy script is stale: '+script.output);
    console.log('✓ Legacy closure/current sources, ES5 parser, fixed tools, budget '+meta.compatBytes+' bytes; package hard limit checked by Toy packaging');
  }else{for(const sheet of styles)writeGenerated(path.join(ROOT,sheet.output),sheet.code);for(const script of lazyScripts)writeGenerated(path.join(ROOT,script.output),script.code);writeGenerated(path.join(ROOT,OUTPUT),code);writeGenerated(path.join(ROOT,META),metaText);console.log('Generated '+OUTPUT+'; '+meta.sources.length+' scripts + '+lazyScripts.length+' lazy scripts; '+meta.compatBytes+' bytes; package hard limit checked by Toy packaging');}
}
module.exports={build,inputs,styleInputs,lazyInputs:(root=ROOT)=>arcadeClosure.inputs(root),buildLazy:(root=ROOT)=>arcadeClosure.build(root,tool),tool,writeGenerated,ROOT,OUTPUT,META,ONLINE_TARGET_BYTES};
