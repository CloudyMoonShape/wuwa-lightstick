/* Text-only localization. Control IDs, device state and handlers never change. */
(() => {
  const catalog = window.RESONATOR_MESSAGES || {};
  const normalize = value => String(value).trim().replace(/\s+/g, ' ');
  const locale = value => /^(zh|en|ja)(?:-|$)/i.exec(value || '')?.[1].toLowerCase();
  const key = 'resonator.language';
  let saved;
  try { saved = localStorage.getItem(key); } catch {}
  const browserLanguage = () => (navigator.languages || [navigator.language]).map(locale).find(Boolean) || 'en';
  const initialUrl = new URL(location.href);
  let manual = locale(initialUrl.searchParams.get('lang')) || locale(initialUrl.pathname.split('/')[1]) || locale(saved);
  let language = manual || browserLanguage();
  const outputs = new Map(), sources = new WeakMap(), reverse = new Map();
  for (const [source, translations] of Object.entries(catalog)) {
    reverse.set(normalize(source), source);
    for (const translated of Object.values(translations)) reverse.set(normalize(translated), source);
  }
  function t(source, params = {}, depth = 0) {
    const canonical = catalog[normalize(source)] ? normalize(source) : reverse.get(normalize(source)) || source;
    const template = catalog[canonical]?.[language] || canonical;
    const result = template.replace(/\{(\w+)\}/g, (_, name) => {
      const value = params[name] ?? `{${name}}`;
      return depth < 3 && typeof value === 'string' && reverse.has(normalize(value)) ? t(value, {}, depth + 1) : value;
    });
    if (Object.keys(params).length) {
      outputs.set(result, {source: canonical, params: {...params}});
      if (outputs.size > 512) outputs.delete(outputs.keys().next().value);
    }
    return result;
  }
  function translateValue(node, field, value, write) {
    let fields = sources.get(node);
    if (!fields) sources.set(node, fields = new Map());
    let record = fields.get(field);
    if (!record || value !== record.rendered) {
      const clean = normalize(value);
      const dynamic = outputs.get(value);
      const source = dynamic?.source || reverse.get(clean);
      if (!source) return;
      record = {source, params: dynamic?.params || {}, prefix: value.match(/^\s*/)[0], suffix: value.match(/\s*$/)[0]};
      fields.set(field, record);
    }
    const rendered = record.prefix + t(record.source, record.params) + record.suffix;
    record.rendered = rendered;
    if (rendered !== value) write(rendered);
  }
  const attrs = ['title','aria-label','alt','placeholder'];
  function translateDOM(root = document.documentElement) {
    if (root.nodeType === 3) {
      if (!root.parentElement?.closest('script,style,code,svg,[translate="no"]')) translateValue(root, 'text', root.nodeValue, value => { root.nodeValue = value; });
      return;
    }
    if (root.nodeType !== 1 || root.matches('script,style,code,svg,[translate="no"]')) return;
    for (const attr of attrs) if (root.hasAttribute(attr)) translateValue(root, attr, root.getAttribute(attr), value => root.setAttribute(attr, value));
    if (root.matches('meta[name="description"]')) translateValue(root, 'content', root.content, value => { root.content = value; });
    for (const child of root.childNodes) translateDOM(child);
  }
  function updateMetadata() {
    const config = window.RESONATOR_SEO;
    if (!config || !document.querySelector) return;
    const [name, description, article] = config.copy[language];
    const title = config.principles ? article : name;
    const path = manual ? '/' + language + '/' + (config.principles ? 'principles' : '') : (config.principles ? '/principles' : '/');
    const url = config.origin + path;
    document.title = title;
    for (const [selector, content] of Object.entries({
      'meta[name="description"]': description, 'meta[property="og:title"]':title,
      'meta[name="twitter:title"]':title,'meta[property="og:description"]':description,
      'meta[name="twitter:description"]':description,'meta[property="og:url"]':url,
      'meta[property="og:locale"]':{zh:'zh_CN',en:'en_US',ja:'ja_JP'}[language]
    })) document.querySelector(selector)?.setAttribute('content', content);
    document.querySelector('link[rel="canonical"]')?.setAttribute('href',url);
    document.querySelector('link[type="text/markdown"]')?.setAttribute('href',path.endsWith('/') ? path+'index.md' : path+'.md');
    const structured = document.querySelector('script[type="application/ld+json"]');
    if (structured) {
      const data=JSON.parse(structured.textContent);
      Object.assign(data,{name:title,description,url,inLanguage:document.documentElement.lang,'@id':url+(config.principles?'#article':'#app')});
      structured.textContent=JSON.stringify(data);
    }
    document.querySelectorAll('.resonator-brand,.site-foot-logo').forEach(link=>{link.href='/'+language+'/';});
    document.querySelectorAll('.site-foot a').forEach(link=>{if (/\/principles(?:\.html)?$/.test(new URL(link.href,location.href).pathname)) link.href='/'+language+'/principles';});
    document.querySelectorAll('.site-head > .ms-link').forEach(link=>{link.href='/'+language+'/';});
  }
  function apply() {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : language;
    translateDOM();
    document.querySelectorAll('[data-language]').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.language === language)); });
    updateMetadata();
    document.querySelectorAll('.site-foot [lang]').forEach(node => { node.lang = document.documentElement.lang; });
  }
  function setLanguage(value) {
    manual = locale(value);
    language = manual || browserLanguage();
    try { if (manual) localStorage.setItem(key, manual); else localStorage.removeItem(key); } catch {}
    const url = new URL(location.href);
    const isPrinciples = /principles(?:\.html)?\/?$/.test(url.pathname);
    url.pathname = manual ? '/' + manual + '/' + (isPrinciples ? 'principles' : '') : (isPrinciples ? '/principles' : '/');
    url.searchParams.delete('lang');
    history.replaceState(null, '', url);
    apply();
    window.dispatchEvent(new CustomEvent('resonatorlanguagechange', {detail: {language}}));
  }
  window.ResonatorI18n = {t, setLanguage, translateDOM, get language() { return language; }};
  document.addEventListener('click', event => { const button = event.target.closest('[data-language]'); if (button) setLanguage(button.dataset.language); });
  apply();
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'childList') record.addedNodes.forEach(translateDOM);
      else translateDOM(record.target);
    }
  });
  observer.observe(document.documentElement, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:attrs});
})();
