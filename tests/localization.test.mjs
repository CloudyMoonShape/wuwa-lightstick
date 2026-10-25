import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const script = readFileSync(new URL('../web/i18n.js',import.meta.url),'utf8');
function boot({query='', saved, languages=['zh-CN'], blocked=false}={}) {
 const text={nodeType:3,nodeValue:'连接应援棒',parentElement:{closest:()=>null}};
 const root={nodeType:1,childNodes:[text],matches:()=>false,hasAttribute:()=>false};
 const store=new Map(saved ? [['resonator.language',saved]] : []);
 const context={URL, CustomEvent:class{constructor(type,init){Object.assign(this,{type,...init})}},
  document:{documentElement:root,querySelectorAll:()=>[],addEventListener:()=>{}},
  navigator:{languages},location:{href:'https://example.com/'+query},history:{replaceState:(_a,_b,url)=>{context.location.href=String(url)}},
  localStorage:{getItem:k=>{if(blocked)throw Error();return store.get(k)},setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
  MutationObserver:class{observe(){}},dispatchEvent:()=>{},
  RESONATOR_MESSAGES:{'连接应援棒':{en:'Connect lightstick',ja:'応援棒を接続'},'已连接 {device}':{en:'Connected {device}',ja:'接続済み {device}'}}};
 context.window=context;vm.runInNewContext(script,context);return {api:context.ResonatorI18n,text,root,context};
}
test('language precedence uses supported browser locale, saved choice, then URL override',()=>{
 assert.equal(boot({languages:['fr-FR','ja-JP']}).api.language,'ja');
 assert.equal(boot({saved:'en',languages:['ja']}).api.language,'en');
 assert.equal(boot({saved:'en',query:'?lang=zh-TW'}).api.language,'zh');
 assert.equal(boot({query:'?lang=invalid',languages:['fr'],blocked:true}).api.language,'en');
});
test('live language changes preserve DOM nodes and interpolate device labels',()=>{
 const {api,text,root,context}=boot();api.setLanguage('ja');assert.equal(root.childNodes[0],text);assert.equal(text.nodeValue,'応援棒を接続');
 assert.equal(api.t('已连接 {device}',{device:'JFKJ-FBFB'}),'接続済み JFKJ-FBFB');
 api.setLanguage('en');assert.equal(text.nodeValue,'Connect lightstick');api.setLanguage('auto');assert.equal(text.nodeValue,'连接应援棒');assert.equal(new URL(context.location.href).searchParams.has('lang'),false);
});
test('all catalog translations preserve interpolation parameters',()=>{
 for(const file of ['static','dynamic'])for(const [source,entry]of Object.entries(JSON.parse(readFileSync(new URL(`../web/locales/${file}.json`,import.meta.url),'utf8')))) {
  for(const lang of ['en','ja']){assert.ok(entry[lang],`${source} ${lang}`);assert.deepEqual([...source.matchAll(/\{\w+\}/g)].map(x=>x[0]).sort(),[...entry[lang].matchAll(/\{\w+\}/g)].map(x=>x[0]).sort());}
 }
});
