# Cloudflare Pages 静态部署

正式入口：https://wuwa-lightstick.pages.dev/

2026-10-24 已完成 Direct Upload，并回读正式入口及资源与本地字节一致。部署 ID：`2ef250a6`。

首页把样式和应用/SDK 代码内联为一个 HTML，无第三方字体、图片、脚本、分析 SDK；浏览器只需拿到首页即可通过本机蓝牙操作。源文件仍模块化，便于开发。

仅公开 `dist/` 中列入白名单的网页资源。不要上传仓库根目录、固件、vendor、虚拟环境或凭据。

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
