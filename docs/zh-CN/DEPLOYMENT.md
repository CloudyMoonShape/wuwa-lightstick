# 部署

[文档](README.md) · [English](../DEPLOYMENT.md)

先构建，再启动预览或上传。构建会插入共用页头和页脚，并将控制程序、样式和字体子集打包到一个 HTML 中。

## 本地预览

使用 Node.js 24 和 Python 3。在仓库根目录运行：

```sh
npm test
npm run build
python3 -m http.server 8765 -d dist
```

打开 [localhost:8765](http://localhost:8765)。静态预览不需要 Cloudflare 凭据。到访计数不会登记 localhost 访问。

## Cloudflare Pages

当前站点采用 Direct Upload。在终端环境中设置 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`。使用自己的账号，并授予发布所需的 Pages 权限。不要把凭据值提交到仓库。

新建项目时运行：

```sh
npx wrangler@4.152.0 pages project create YOUR_PROJECT --production-branch main
```

每次构建后运行：

```sh
npx wrangler@4.152.0 pages deploy dist --project-name YOUR_PROJECT --branch main
```

只上传 `dist/`，不要上传仓库根目录。Wrangler 会单独编译根目录的 `functions/`。构建只复制指定的公开资源，不包含厂家固件、本机环境、下载的工具或凭据。

构建输出当前 HTML 体积及 gzip 估算。请以当前版本的输出为准。历史体积不能代表当前文件，也不是加载时间保证。

## 可选到访计数

遥控器不依赖计数器。启用时，创建自己的 D1 数据库并应用迁移，在 Pages 生产环境中绑定为 `VISITORS_DB`。预览环境不要连接生产库。

自行部署可从 [wrangler.example.jsonc](../../wrangler.example.jsonc) 开始。先替换示例值，不要复用本项目的生产数据库绑定。

更新生产数据库配置，以及 `web/visitors.js` 和 `functions/api/visitors.js` 中的两个来源名单。详见[到访计数](VISITORS.md)。建立 D1 数据库需要额外数据库权限。

只有 `/api/visitors` 进入函数。其他路径保持静态响应。计数失败不能阻塞控制器。

## 域名与图片

先在 Pages 项目中关联自定义域名，再配置 DNS。等待域名验证和证书均已生效，然后用浏览器打开域名。参见 [Cloudflare 自定义域名](https://developers.cloudflare.com/pages/configuration/custom-domains/)。

新域名是新的浏览器来源。用户需要重新选择并授权蓝牙设备。已保存的设置不会跨来源迁移。

背景通过低优先级的同源请求单独加载，不阻塞控件。硬件和演出照片只在原理页加载。重新分发图片前，请检查[第三方材料](../../THIRD_PARTY.zh-CN.md)。

美术资源文件名包含内容哈希，并使用长期缓存。更换图片时，同步更新文件名、HTML 引用和构建白名单。

## 发布检查

1. 运行测试和构建。
2. 检查 `dist/` 是否包含非预期文件。
3. 发布构建产物。
4. 检查正式首页、原理页、许可证及引用资源。
5. 对比线上内容与本地构建。
6. 检查浏览器控制台、桌面布局和窄屏布局。
7. 若变更涉及设备行为，用真实灯棒测试相应控件。

上传成功不能证明线上页面或硬件正常。详见[验证](VERIFICATION.md)。

部署方法参见 [Cloudflare Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)。Direct Upload 项目不能直接切换为 Git 集成；需要此流程时应新建项目。
