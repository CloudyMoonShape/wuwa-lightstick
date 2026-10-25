"""Build crawlable language pages and factual discovery documents; no service calls."""
from html import escape
from html.parser import HTMLParser
from pathlib import Path
import json
import re
import shutil
from urllib.parse import urljoin

ORIGIN = 'https://wuwa.south-wall.com'
LANGUAGES = {'zh': 'zh-CN', 'en': 'en', 'ja': 'ja'}
COPY = {
 'zh': ('共鸣者 Resonator｜鸣潮音乐会应援棒控制工具', '通过浏览器连接鸣潮音乐会应援棒，调色、调亮度、播放原生灯效和音乐律动。支持中英日；iPhone 使用 Bluefy，连不上时先更换新电池。', '鸣潮应援棒如何工作｜蓝牙、灯效与 SDK · 共鸣者'),
 'en': ('Resonator | Wuthering Waves Lightstick Controller', 'Control your Wuthering Waves concert lightstick in your browser: colors, brightness, native effects and music sync. Use Bluefy on iPhone. Includes a JavaScript SDK.', 'How Wuthering Waves Lightsticks Work | Resonator'),
 'ja': ('Resonator｜鳴潮コンサートのペンライトコントローラー', 'ブラウザーから鳴潮コンサートのペンライトを操作。色、明るさ、内蔵エフェクト、音楽連動に対応。iPhoneはBluefyを使用。中英日対応、JavaScript SDKも公開。', '鳴潮ペンライトの仕組み｜Bluetooth・エフェクト・SDK')
}

class PageParser(HTMLParser):
    def __init__(self, language, messages):
        super().__init__(convert_charrefs=False)
        self.language, self.messages, self.output, self.stack = language, messages, [], []
    def translated(self, text):
        key = re.sub(r'\s+', ' ', text.strip())
        value = self.messages.get(key, {}).get(self.language)
        if not value: return text
        return re.match(r'^\s*', text)[0] + escape(value, quote=False) + re.search(r'\s*$', text)[0]
    def handle_decl(self, data): self.output.append('<!' + data + '>')
    def handle_comment(self, data): self.output.append('<!--' + data + '-->')
    def handle_entityref(self, name): self.output.append('&' + name + ';')
    def handle_charref(self, name): self.output.append('&#' + name + ';')
    def handle_data(self, text):
        self.output.append(text if any(self.stack) else self.translated(text))
    def handle_starttag(self, tag, attrs): self.start(tag, attrs, False)
    def handle_startendtag(self, tag, attrs): self.start(tag, attrs, True)
    def start(self, tag, attrs, closed):
        values = dict(attrs)
        skip = tag in ('script', 'style', 'svg', 'code') or values.get('translate') == 'no'
        result = []
        for key, value in attrs:
            if value is not None:
                if tag == 'html' and key == 'lang': value = LANGUAGES[self.language]
                if key in ('title','aria-label','alt','placeholder'):
                    value = self.messages.get(re.sub(r'\s+', ' ', value.strip()), {}).get(self.language, value)
                if key in ('href','src','srcset','data-guide-src') and value.startswith(('assets/','moonshade/','LICENSE.txt')): value = '/' + value
                if key == 'href' and value in ('/', 'principles.html', '/principles', '/principles.html'):
                    value = f'/{self.language}/' + ('principles' if 'principles' in value else '')
            result.append(key if value is None else key + '="' + escape(value, quote=True) + '"')
        self.output.append('<' + tag + (' ' if result else '') + ' '.join(result) + ('/>' if closed else '>'))
        if not closed and tag not in ('area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'): self.stack.append(skip)
    def handle_endtag(self, tag):
        if self.stack: self.stack.pop()
        self.output.append('</' + tag + '>')

def path_for(language, principles=False): return f'/{language}/' + ('principles' if principles else '')

def metadata(html, language, path, principles=False):
    title, description, article_title = COPY[language]
    if principles: title = article_title
    url = ORIGIN + path
    html = re.sub(r'<title>.*?</title>', '<title>'+escape(title)+'</title>', html, flags=re.S)
    html = re.sub(r'<meta name="description" content="[^"]*"\s*/?>', '<meta name="description" content="'+escape(description,quote=True)+'">', html)
    html = re.sub(r'<link rel="canonical"[^>]*>', '', html)
    extras = [f'<link rel="canonical" href="{url}">', '<meta name="robots" content="index,follow,max-image-preview:large">', '<link rel="describedby" href="/llms.txt">', f'<link rel="alternate" type="text/markdown" href="{path+"index.md" if path.endswith("/") else path+".md"}">']
    for lang, code in LANGUAGES.items(): extras.append(f'<link rel="alternate" hreflang="{code}" href="{ORIGIN}{path_for(lang,principles)}">')
    extras.append(f'<link rel="alternate" hreflang="x-default" href="{ORIGIN}{"/principles" if principles else "/"}">')
    social = {'og:type':'article' if principles else 'website','og:site_name':'Resonator','og:title':title,'og:description':description,'og:url':url,'og:locale':{'zh':'zh_CN','en':'en_US','ja':'ja_JP'}[language],'og:image':ORIGIN+'/assets/social/resonator.png','og:image:width':'1280','og:image:height':'900','og:image:alt':'Resonator browser lightstick controller','twitter:card':'summary_large_image','twitter:creator':'@CloudyMoonShape','twitter:title':title,'twitter:description':description,'twitter:image':ORIGIN+'/assets/social/resonator.png'}
    for key,value in social.items(): extras.append(f'<meta {"property" if key.startswith("og:") else "name"}="{key}" content="{escape(value,quote=True)}">')
    schema={'@context':'https://schema.org','@type':'TechArticle' if principles else 'WebApplication','@id':url+'#'+('article' if principles else 'app'),'name':title,'description':description,'url':url,'inLanguage':LANGUAGES[language],'author':{'@type':'Person','name':'CloudyMoonShape','url':'https://x.com/CloudyMoonShape'},'license':ORIGIN+'/LICENSE.txt','isPartOf':{'@type':'WebSite','@id':ORIGIN+'/#website','name':'Resonator','alternateName':'共鸣者','url':ORIGIN+'/'}}
    if not principles: schema.update({'applicationCategory':'UtilitiesApplication','operatingSystem':'Web browser','browserRequirements':'Web Bluetooth required for device control. Use Bluefy on iPhone.','sameAs':'https://github.com/CloudyMoonShape/wuwa-lightstick'})
    extras.append('<script>window.RESONATOR_SEO='+json.dumps({'principles':principles,'copy':COPY,'origin':ORIGIN},ensure_ascii=False).replace('<','\\u003c')+';</script>')
    extras.append('<script type="application/ld+json">'+json.dumps(schema,ensure_ascii=False).replace('<','\\u003c')+'</script>')
    return html.replace('</head>', '\n'.join(extras)+'\n</head>')

class MarkdownParser(HTMLParser):
    """Text companion from the same pre-rendered visible source, not a second claim set."""
    def __init__(self):
        super().__init__(); self.out=[]; self.skip=0
    def handle_starttag(self,tag,attrs):
        if tag in ('script','style','svg'): self.skip+=1
        if self.skip: return
        if tag in ('h1','h2','h3','h4'): self.out.append('\n\n'+'#'*int(tag[1])+' ')
        elif tag in ('p','section','details','div','ol','ul'): self.out.append('\n\n')
        elif tag=='li': self.out.append('\n- ')
        elif tag=='br':self.out.append('\n')
        elif tag=='a':
            href=dict(attrs).get('href','')
            if href and not href.startswith('#'):self.out.append(' '+urljoin(ORIGIN,href)+' ')
    def handle_endtag(self,tag):
        if tag in ('script','style','svg'):self.skip=max(0,self.skip-1)
    def handle_data(self,data):
        if not self.skip:self.out.append(data)
    def result(self):return re.sub(r'\n{3,}','\n\n',''.join(self.out)).strip()+'\n'

def build_discovery(root, dest):
    messages={}
    for p in (root/'web/locales').glob('*.json'):messages.update(json.loads(p.read_text()))
    messages['Language']={'zh':'语言','en':'Language','ja':'言語'}
    urls=[]
    for principles, filename in [(False,'index.html'),(True,'principles.html')]:
        source=(dest/filename).read_text()
        # Default entry retains browser detection. Explicit language URLs are stable.
        (dest/filename).write_text(metadata(source,'zh','/principles' if principles else '/',principles))
        for lang in LANGUAGES:
            parser=PageParser(lang,messages);parser.feed(source)
            rendered=metadata(''.join(parser.output),lang,path_for(lang,principles),principles)
            folder=dest/lang;folder.mkdir(exist_ok=True)
            (folder/filename).write_text(rendered)
            md=MarkdownParser();md.feed(rendered)
            (folder/('principles.md' if principles else 'index.md')).write_text(md.result())
            urls.append((path_for(lang,principles),principles))
        default_md=dest/('principles.md' if principles else 'index.md')
        shutil.copyfile(dest/'zh'/default_md.name,default_md)
    # Only public, curated documents; GitHub remains the complete source record.
    docs=('SDK','PROTOCOL','NATIVE-EFFECTS','IOS','FUNCTIONS')
    (dest/'reference').mkdir(exist_ok=True)
    for name in docs:
        text=(root/'docs'/f'{name}.md').read_text()
        text=text.replace('../../web/assets/ios/',ORIGIN+'/assets/ios/').replace('../web/assets/ios/',ORIGIN+'/assets/ios/')
        def absolute(match):
            target=match.group(1)
            if '://' in target or target.startswith('#'):return match.group(0)
            return ']('+urljoin('https://github.com/CloudyMoonShape/wuwa-lightstick/blob/main/docs/',target)+')'
        (dest/'reference'/f'{name.lower()}.md').write_text(re.sub(r'\]\(([^)]+)\)',absolute,text))
    llms='''# Resonator (共鸣者)

> A browser controller for Wuthering Waves concert lightsticks, made by CloudyMoonShape. It supports colors, brightness, native effects, extended effects and music sync. The interface supports Chinese, English and Japanese.

Use a Web Bluetooth browser for hardware control. iPhone Safari and Chrome do not connect directly; the illustrated guide uses Bluefy. Replace depleted batteries before retrying a failed connection. Device commands and audio processing run locally; the optional visitor counter uses a server endpoint. Native effects execute on the lightstick. Extended effects send browser-generated commands.

Research findings apply to the documented sample, not every lightstick or firmware. Venue radio findings are static analysis, not a verified venue-control product. The source-available license permits free development and sharing but restricts sales, paid hosting and commercial bundles. Public source does not mean an unrestricted open-source license. Third-party artwork retains separate rights.

## Start here

- [English controller](https://wuwa.south-wall.com/en/index.md): Text version of the controller and connection instructions.
- [中文控制页](https://wuwa.south-wall.com/zh/index.md): 中文说明。
- [日本語コントローラー](https://wuwa.south-wall.com/ja/index.md): 日本語の説明。
- [How it works](https://wuwa.south-wall.com/en/principles.md): Hardware, Bluetooth and research boundaries.
- [iPhone / Bluefy guide](https://wuwa.south-wall.com/reference/ios.md): Connection steps and battery troubleshooting.

## Development and evidence

- [JavaScript SDK](https://wuwa.south-wall.com/reference/sdk.md): Client API and browser support.
- [Protocol](https://wuwa.south-wall.com/reference/protocol.md): Observed commands and evidence limits.
- [Native effects](https://wuwa.south-wall.com/reference/native-effects.md): Firmware effects and distinctions from browser effects.
- [Function reference](https://wuwa.south-wall.com/reference/functions.md): Findings for developers.
- [Full text](https://wuwa.south-wall.com/llms-full.txt): Combined text from these public references.
- [Source repository](https://github.com/CloudyMoonShape/wuwa-lightstick): Maintained source and complete documentation.
- [License](https://wuwa.south-wall.com/LICENSE.txt): Authoritative use restrictions.
'''
    (dest/'llms.txt').write_text(llms)
    (dest/'llm.txt').write_text(llms) # Common singular spelling; same content, no hidden directives.
    full=llms+'\n\n'+ '\n\n'.join((dest/'reference'/f'{name.lower()}.md').read_text() for name in docs)
    (dest/'llms-full.txt').write_text(full)
    (dest/'robots.txt').write_text('User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: '+ORIGIN+'/sitemap.xml\n')
    entries=[]
    for path, principles in [('/',False),('/principles',True),*urls]:
        alternates=''.join(f'<xhtml:link rel="alternate" hreflang="{code}" href="{ORIGIN}{path_for(lang,principles)}"/>' for lang,code in LANGUAGES.items())
        entries.append('<url><loc>'+ORIGIN+path+'</loc>'+alternates+f'<xhtml:link rel="alternate" hreflang="x-default" href="{ORIGIN}{"/principles" if principles else "/"}"/></url>')
    (dest/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'+''.join(entries)+'</urlset>\n')
    (dest/'assets/social').mkdir(exist_ok=True)
    shutil.copy2(root/'docs/screenshots/controller-desktop-en.png',dest/'assets/social/resonator.png')
    p=dest/'404.html';p.write_text(p.read_text().replace('</head>','<meta name="robots" content="noindex,follow"></head>'))
