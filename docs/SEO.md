# Search and AI discovery

[Documentation](README.md) · [简体中文](zh-CN/SEO.md)

The build produces static Chinese, English, and Japanese pages. Crawlers can read each language without running JavaScript. The root URL still follows the visitor's browser language. Explicit language paths take priority over a saved preference.

| Resource | Purpose |
|---|---|
| `/zh/`, `/en/`, `/ja/` | Stable controller URLs. |
| `/zh/principles`, `/en/principles`, `/ja/principles` | Stable explanation URLs. |
| `/sitemap.xml` | The eight canonical entry pages and their language alternates. |
| `/robots.txt` | Allows public crawling; excludes the visitor API. |
| `/llms.txt` | Short project summary and links to authoritative text. |
| `/llm.txt` | Compatibility alias for the singular spelling. |
| `/llms-full.txt` | Combined public SDK, protocol, native-effect, iPhone, and function references. |
| `/en/index.md`, `/en/principles.md` | Text companions generated from the corresponding HTML. Chinese and Japanese versions are also built. |
| `/reference/*.md` | Selected public technical documents, with absolute source links. |

Each HTML page has a descriptive title, description, canonical URL, reciprocal `hreflang`, and social sharing metadata. The controller has one semantic H1. Structured data identifies the application or technical article and its creator. It contains no invented reviews or ratings. The error page is marked `noindex`.

The language pill updates the URL, visible text, canonical metadata, and structured data without reloading the controller. It does not reset Bluetooth or effect state. Existing `?lang=zh`, `?lang=en`, and `?lang=ja` links still work.

## Verify and submit

1. Run `npm test` and `npm run build`.
2. Deploy to the **personal** Cloudflare account. Use the account-selecting wrapper specified by the maintainer's environment. Never use company credentials for this project.
3. Check the eight HTML routes, the text resources, and the social image on the production domain.
4. Submit `https://wuwa.south-wall.com/sitemap.xml` in [Google Search Console](https://search.google.com/search-console/sitemaps?resource_id=sc-domain%3Asouth-wall.com).
5. Inspect one URL per language. Check the rendered title, canonical URL, and indexing status.
6. Add the same sitemap in [Bing Webmaster Tools](https://www.bing.com/webmasters/).

Google DNS ownership verification is separate from sitemap submission. Publishing a sitemap does not submit it to a logged-in webmaster account.

## Limits

`llms.txt` is a proposal, not an indexing or citation guarantee. Google states that its AI search features use the same core SEO requirements and need no special AI file or schema. Keep the text accurate, accessible, and consistent with the visible pages. Do not add hidden ranking instructions or claim unrestricted open-source licensing.

- [Google: localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [Google: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- [llms.txt proposal](https://llmstxt.org/)
