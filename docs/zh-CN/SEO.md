# 搜索与 AI 检索

[文档](README.md) · [English](../SEO.md)

构建直接生成中文、英文和日文 HTML，抓取工具无需运行 JavaScript 即可读到对应语言。根网址仍按浏览器语言显示。明确的语言路径优先于已保存的偏好。

| 资源 | 用途 |
|---|---|
| `/zh/`、`/en/`、`/ja/` | 三语控制页的固定网址。 |
| `/zh/principles`、`/en/principles`、`/ja/principles` | 三语原理页。 |
| `/sitemap.xml` | 八个规范入口及语言对应关系。 |
| `/robots.txt` | 允许公开抓取，排除访客 API。 |
| `/llms.txt` | 项目摘要和权威文本入口。 |
| `/llm.txt` | 单数拼写的兼容入口。 |
| `/llms-full.txt` | 合并后的 SDK、协议、原生灯效、iPhone 和函数说明。 |
| `/zh/index.md`、`/zh/principles.md` | 从对应 HTML 生成的文本版，同时提供英日文。 |
| `/reference/*.md` | 选定的公开技术文档，使用绝对来源链接。 |

各页面包含独立标题、描述、规范网址、双向语言标注和社交分享信息。控制页使用一个语义 H1。结构化数据描述应用或技术文章及作者，不填写虚构评分或评论。错误页禁止索引。

语言胶囊同时更新网址、正文、规范网址和结构化数据，不刷新控制台，也不重置蓝牙或灯效。原有 `?lang=zh`、`?lang=en`、`?lang=ja` 链接继续有效。

## 检查与提交

1. 执行 `npm test` 和 `npm run build`。
2. 部署到 **个人** Cloudflare 账户，使用维护环境规定的账号选择包装脚本。本项目不能使用公司凭据。
3. 回读八个 HTML 路由、文本资源和分享图片。
4. 在 [Google Search Console](https://search.google.com/search-console/sitemaps?resource_id=sc-domain%3Asouth-wall.com) 提交 `https://wuwa.south-wall.com/sitemap.xml`。
5. 每种语言检查一个网址，核对渲染结果、规范网址和收录状态。
6. 在 [Bing Webmaster Tools](https://www.bing.com/webmasters/) 提交相同 sitemap。

DNS 所有权验证与 sitemap 提交是不同步骤。发布 sitemap 不等于已登录站长平台并提交。

## 边界

`llms.txt` 是提议性约定，不能保证收录或引用。Google 的 AI 搜索沿用基本 SEO 要求，不要求专门的 AI 文件或结构化类型。重点是事实准确、文本可读、与可见页面一致。不要加入隐藏的排名指令，也不要将本项目描述为不受限制的开源许可。

- [Google：多语言页面](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [Google：AI 搜索与网站](https://developers.google.com/search/docs/appearance/ai-features)
- [llms.txt 提议](https://llmstxt.org/)
