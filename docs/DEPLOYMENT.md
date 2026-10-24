# Cloudflare Pages 静态部署

正式入口：https://wuwa-lightstick.pages.dev/

使用 Direct Upload；发布后回读正式入口及资源，逐项与本地构建比较。当前视觉版本的检查记录见 [展示审查](DESIGN-AUDIT.md)。

首页把样式、字体子集和应用/SDK 代码内联为一个 HTML，不请求外部字体、图片或脚本，不含分析 SDK；浏览器只需拿到首页即可通过本机蓝牙操作。源文件仍模块化，便于开发。当前首页约 98 KB 原始体积、30 KB gzip 估算；这不是中国运营商延迟测量。

仅公开 `dist/` 中列入白名单的网页资源：控制台、原理页、SDK 与混色模块、404、许可与站点响应头；另包含 `assets/hardware/` 四张已清理元数据的 WebP 和字体 OFL 许可。硬件照片在原理页按需加载，不进入控制台 HTML。不要上传仓库根目录、固件、vendor、虚拟环境或凭据。

```bash
npm test
npm run build
npx wrangler@4.152.0 pages project create wuwa-lightstick --production-branch main
npx wrangler@4.152.0 pages deploy dist --project-name wuwa-lightstick --branch main
```

首次创建项目后，后续只执行 deploy。通过环境变量提供自己的 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`，不要把值写入版本控制。访问令牌只需所选账号相应 Pages 权限。

使用 Direct Upload，现阶段不启用 CI 或 Git 集成。Cloudflare 表明 Direct Upload 项目无法直接切换到 Git 集成；未来需要该功能时另建项目。

页面与音频分析全部在浏览器运行，无控制后端、无音频上传、无站点分析脚本。Cloudflare 仍会处理普通 HTTP 访问数据。Web Bluetooth 需要 HTTPS 或 localhost 及兼容浏览器，访客自己授权选中的设备。

上线检查：确认部署成功、正式域名资源返回 200、浏览器页面/原理页可交互、控制台无错误、仅白名单资源被上传。软件检查不代替新版本实物验收。

资料：https://developers.cloudflare.com/pages/get-started/direct-upload/
