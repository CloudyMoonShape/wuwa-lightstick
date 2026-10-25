import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const root=new URL('../',import.meta.url);
execFileSync('python3',['scripts/prepare_site.py'],{cwd:root,stdio:'pipe'});
const read=path=>readFileSync(new URL('../dist/'+path,import.meta.url),'utf8');
const visible=html=>html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/g,'');
test('language pages contain translated HTML before JavaScript, with reciprocal canonical metadata',()=>{
 for(const lang of ['zh','en','ja']) for(const page of ['index','principles']){
  const html=read(`${lang}/${page}.html`),text=visible(html),path=`/${lang}/${page==='index'?'':'principles'}`;
  assert.ok(text.includes(`<html lang="${lang==='zh'?'zh-CN':lang}">`));
  assert.ok(text.includes(`<link rel="canonical" href="https://wuwa.south-wall.com${path}">`));
  for(const alt of ['zh','en','ja']) assert.ok(text.includes(`hreflang="${alt==='zh'?'zh-CN':alt}" href="https://wuwa.south-wall.com/${alt}/${page==='index'?'':'principles'}"`));
  assert.equal((text.match(/<h1\b/g)||[]).length,1);
  if(lang==='en')assert.ok(text.includes(page==='index'?'Connect lightstick':'Your lightstick.'));
  if(lang==='ja')assert.ok(text.includes(page==='index'?'応援棒を接続':'自分の手で。'));
  assert.ok(!/\b(?:src|href|data-guide-src)="assets\//.test(text));
  const data=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(data.url,'https://wuwa.south-wall.com'+path);
  assert.equal(data.inLanguage,lang==='zh'?'zh-CN':lang);
  assert.ok(!data.aggregateRating);
 }
});
test('sitemap, robots and AI text entry points are available and factual',()=>{
 const sitemap=read('sitemap.xml');assert.equal((sitemap.match(/<loc>/g)||[]).length,8);
 assert.ok(read('robots.txt').includes('Sitemap: https://wuwa.south-wall.com/sitemap.xml'));
 assert.ok(read('robots.txt').includes('Disallow: /api/'));
 assert.equal(read('llm.txt'),read('llms.txt'));
 for(const file of ['llms.txt','llms-full.txt','en/index.md','ja/principles.md'])assert.ok(read(file).length>100);
 assert.ok(read('llms.txt').includes('source-available'));
 assert.ok(!read('reference/ios.md').includes('../../web/assets'));
 assert.ok(read('404.html').includes('noindex,follow'));
 assert.ok(existsSync(new URL('../dist/assets/social/resonator.png',import.meta.url)));
});
