# 本轮验证 · 2026-10-24

## 已交付

- 正式网页：https://wuwa-lightstick.pages.dev/
- 原理页：https://wuwa-lightstick.pages.dev/principles.html
- Cloudflare Pages 项目：wuwa-lightstick，production branch main，Direct Upload。
- 新工作目录独立于 Project-Wuling 原件，未改变原仓库。用户随后授权创建私有源码仓库 `CloudyMoonShape/wuwa-lightstick`，首个提交使用 GitHub noreply 作者邮箱。

## 通过

- Python 3.12 新建 `.venv`，安装 `bleak==3.0.2`、`pyserial==3.5`。
- `python -I scripts/venue_packet.py color 2 255 0 0` 输出 `02 10 c0 ff ee 00 00 01 10 13 13 13 13 ec 13 13 1c 00`。
- Python 源码编译检查、前端 JavaScript 语法检查、HTML 本地资源路径检查。
- SDK 11 个模拟测试：GRB 与校验、无效输入、口令先于设色、最新帧合并、写失败、断线重连、选择器取消、迟到连接、缺失/错误回显、提前回显与等待动画、认证期间断线。
- 浏览器实际查看桌面与窄屏布局、点击无设备颜色/灯效预览、快速闪光默认阻止、原理页等值白计算（01 00 B4 B4 B4 E3；总和768）。所检查路径没有控制台 warning/error。
- 首版正式域名 HTTP 200 且页面/资源回读一致；轻量版再验证首页、SDK、原理页与许可。
- 线上重新打开并验证交互；站点 `_headers` 生效。
- 轻量版首页内联 SDK、应用代码和样式，仅一次 HTML 请求即可使用；原始约 36 KB、gzip 估算约 13.8 KB。原理页与许可证点击后才加载。部署白名单仅 index.html、sdk.js、principles.html、LICENSE.txt、404.html 及配置 _headers。没有厂家固件、vendor、反编译输出、环境、API 凭据。

## 尚未验证 / 待决定

- 新版 SDK/网页未连接真棒子；真实设备认证、回执时序、断线恢复及音乐视觉同步仍需硬件验收。
- 本轮没有授权麦克风或标签页录音，也未测试本地音频文件播放路径；代码保留原版音频分析并调整界面与停止行为。
- 现场广播、未知固件命令不作可用性承诺；没有 RF 发射、OTA 写入或厂家固件改动。
- 用户已选定免费二次开发与分享、禁止销售/付费托管/付费捆绑，已提供定制社区源码许可 LICENSE；不是标准开源许可。
- Direct Upload 项目未来不能原地改 Git 集成，需要新项目。

## UX 参考

以 Chrome 官方示例理解权限、选择设备和断开连接模式，没有复制第三方产品界面或商标素材。

- https://googlechrome.github.io/samples/web-bluetooth/
- https://googlechrome.github.io/samples/web-bluetooth/device-disconnect.html
- https://developer.chrome.com/docs/capabilities/bluetooth

## 轻量版补充

按用户反馈取消宣传首页，连接/关灯/颜色/亮度置于顶部，音乐与校准折叠。单文件打包后的模块语法检查通过，实际浏览器验证选红色、呼吸、关灯和无控制台错误。中国运营商真实首屏耗时未测量；不声称保证中国访问速度。

## 色板、混色与色轮更新

用户通过命令行确认三原色正常、认可粉红255,32,32，并在网页新版反馈观感显著改善，选择观感混色为唯一网页标准。保留原有未覆盖的硬件/音频验证限制。新增4项颜色测试，加既有11项SDK测试，共15项通过；检查纯色/粉红保持、黄色调节、峰值与亮度分离、白通道保护和色轮连续性。单HTML 42,626字节，gzip估算16,213字节。历史截图可能显示当时的原始RGB模式；当前页面不再提供该模式。
