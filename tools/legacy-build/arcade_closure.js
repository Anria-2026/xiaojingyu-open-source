/* The installed arcade directory is the lazy source closure. Never alter game source strings. */
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function inputs(root){
  const dir=path.join(root,'h5_demo/js/arcade'),names=fs.readdirSync(dir).filter(name=>/^[\w-]+\.js$/.test(name)).sort();
  if(!names.includes('core.js'))throw new Error('Lazy arcade core is missing');
  const rows=names.map(name=>{const relative='h5_demo/js/arcade/'+name,source=fs.readFileSync(path.join(root,relative),'utf8');return {path:relative,source,sha256:sha(source),output:'h5_demo/js/legacy/arcade.'+name.replace(/\.js$/,'.es5.js')};});
  const cfg=JSON.parse(fs.readFileSync(path.join(root,'h5_demo/data/game_cfg.json'),'utf8'));
  for(const game of Object.values((cfg.ARCADE||{}).GAMES||{}))if(game&&game.module&&!rows.some(row=>row.path==='h5_demo/js/'+game.module))throw new Error('Configured arcade module is outside the checked lazy closure: '+game.module);
  return rows;
}
function styles(root,shipping){
  const loader=shipping.find(input=>input.path==='h5_demo/js/arcade_loader.js');
  if(!loader)throw new Error('Lazy arcade loader is outside the shipping manifest');
  const relative='h5_demo/arcade.css',source=fs.readFileSync(path.join(root,relative),'utf8');
  return [{url:'arcade.css'+loader.url.slice(loader.url.indexOf('?')),path:relative,source,sha256:sha(source),output:'h5_demo/js/legacy/styles.arcade.css'}];
}
function build(root,tool){
  const ts=tool('typescript'),esbuild=tool('esbuild'),acorn=tool('acorn'),css=tool('css-tree'),fallback=require('./css_fallback');
  return inputs(root).map(input=>{
    const ast=ts.createSourceFile(input.path,input.source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),patches=[],inlineStyles=[],constants={};
    function literalConstants(node){if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.initializer&&ts.isNumericLiteral(node.initializer))constants[node.name.text]=Number(node.initializer.text);ts.forEachChild(node,literalConstants);}
    literalConstants(ast);
    function visit(node){
      // The explicit style element assignment is the only CSS source. Caption,
      // business/config strings and animation logic are never rewritten.
      if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.EqualsToken&&ts.isPropertyAccessExpression(node.left)&&node.left.name.text==='textContent'&&node.left.expression.getText(ast)==='style'){
        if(!ts.isTemplateExpression(node.right)&&!ts.isNoSubstitutionTemplateLiteral(node.right))throw new Error('Arcade inline CSS requires an explicit build decision: '+input.path);
        const original=node.right.getText(ast),evaluated=vm.runInNewContext('('+original+')',constants, {timeout:1000});
        if(typeof evaluated!=='string')throw new Error('Arcade inline style is not a string');
        const patch=fallback.transform(evaluated,css);
        patches.push({start:node.right.getStart(ast),end:node.right.end,text:'('+original+')+'+JSON.stringify(patch.code)});
        inlineStyles.push({sourceSha256:sha(evaluated),patchSha256:sha(patch.code),fallbackDeclarations:patch.fallbackDeclarations,hasMappings:patch.hasMappings});
      }
      ts.forEachChild(node,visit);
    }
    visit(ast);
    let source=input.source;for(const patch of patches.sort((a,b)=>b.start-a.start))source=source.slice(0,patch.start)+patch.text+source.slice(patch.end);
    const translated=ts.transpileModule(source,{fileName:input.path,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES5,module:ts.ModuleKind.CommonJS,downlevelIteration:true,removeComments:true,newLine:ts.NewLineKind.LineFeed}});
    const errors=(translated.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
    if(errors.length)throw new Error(errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join('\n'));
    const code='/* Generated lazy arcade ES5; edit original sources. */\n'+esbuild.transformSync(translated.outputText,{minify:true,target:'es5',charset:'utf8',legalComments:'none'}).code;
    acorn.parse(code,{ecmaVersion:5,sourceType:'script'});
    return {...input,code,inlineStyles};
  });
}
module.exports={inputs,styles,build};
