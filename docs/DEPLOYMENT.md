# Cloudflare Pages 部署

正式入口：https://wuwa.south-wall.com/

Pages 项目仍为 `wuwa-lightstick`。先在项目中关联自定义域名 `wuwa.south-wall.com`，再添加同名 CNAME 指向 `wuwa-lightstick.pages.dev`。当前采用仅 DNS 解析，页面和 HTTPS 由 Pages 提供。等待域名验证与证书状态均为 active，再检查正式入口。详见 [Cloudflare 自定义域名说明](https://developers.cloudflare.com/pages/configuration/custom-domains/)。

原 `pages.dev` 地址保留为备用。新域名是新的浏览器来源：首次连接需要重新选择并授权应援棒，旧域名保存的个人调节不会自动迁移。

使用 Direct Upload；发布后回读正式入口及资源，逐项与本地构建比较。当前视觉版本的检查记录见 [展示审查](DESIGN-AUDIT.md)。

首页把样式、字体子集、品牌图标和应用/SDK 代码内联为一个 HTML，不请求第三方字体、图片或脚本，不含第三方分析 SDK；浏览器只需拿到首页即可通过本机蓝牙操作。鸣潮官网主视觉作为同源背景低优先级加载、异步解码；桌面 AVIF 为 48,834 字节，手机竖版为 25,527 字节，对应 WebP 后备为 89,284 / 47,428 字节。通过 picture 按视口和格式选择，只下载一张；图片慢或失败时不影响控制功能。图片文件名包含内容哈希，并通过响应头缓存一年；替换图片必须同步更新哈希文件名和构建白名单。到访计数在页面初始化后独立请求同源接口，超时或失败会隐藏，不阻塞遥控器。源文件仍模块化，便于开发。当前首页 111,022 字节原始体积、34,480 字节 gzip 估算；这不是中国运营商延迟测量。

仅公开 `dist/` 中列入白名单的网页资源：控制台、原理页、SDK 与混色模块、404、许可、站点响应头与 Functions 路由；另包含 `assets/hardware/` 四张已清理元数据的 WebP、`assets/artwork/` 桌面/手机各两种背景格式和字体 OFL 许可。硬件照片在原理页按需加载，不进入控制台 HTML。Wrangler 另将根目录 `functions/` 编译到服务端；`_routes.json` 仅让 `/api/visitors` 进入函数，其余页面仍静态直出。不要上传仓库根目录、固件、vendor、虚拟环境或凭据。

```bash
npm test
npm run build
npx wrangler@4.152.0 pages project create wuwa-lightstick --production-branch main
npx wrangler@4.152.0 pages deploy dist --project-name wuwa-lightstick --branch main
```

首次创建项目后，后续只执行 deploy。通过环境变量提供自己的 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`，不要把值写入版本控制。日常发布需要所选账号的 Pages 权限；首次创建或迁移计数数据库另需 D1 写入权限。数据库凭据不进入网页，运行时通过 `VISITORS_DB` 绑定访问专用库。计数初始化与生产、预览隔离见 [到访计数](VISITORS.md)。

`wrangler.jsonc` 为部署配置来源：生产环境绑定计数专用库，预览环境没有生产库权限。Fork 后请填写自己的数据库 ID 和正式域名名单。控制台本地静态预览不需要云端凭据。

使用 Direct Upload，现阶段不启用 CI 或 Git 集成。Cloudflare 表明 Direct Upload 项目无法直接切换到 Git 集成；未来需要该功能时另建项目。

控制与音频分析全部在浏览器运行，无控制后端、无音频上传。唯一动态接口用于匿名到访计数，不接收蓝牙或音频数据；Cloudflare 仍会处理普通 HTTP 访问数据。Web Bluetooth 需要 HTTPS 或 localhost 及兼容浏览器，访客自己授权选中的设备。

上线检查：确认部署成功、正式域名资源返回 200、浏览器页面/原理页可交互、控制台无错误、仅白名单资源被上传。软件检查不代替新版本实物验收。

资料：https://developers.cloudflare.com/pages/get-started/direct-upload/
