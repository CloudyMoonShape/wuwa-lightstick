# 共鸣 · Wuwa Lightstick

在浏览器里，重新点亮你的鸣潮应援棒。

**[打开控制台 ↗](https://wuwa.south-wall.com/)**　[工作原理](https://wuwa.south-wall.com/principles)　[开发文档](docs/README.md)

[![共鸣控制台：色轮、亮度与灯效](docs/screenshots/controller-desktop.png)](https://wuwa.south-wall.com/)

连接自己的应援棒，调色，播放灯效，跟随音乐。蓝牙控制与音频分析都在本机完成，无需账号或控制服务器。首页约 40 KB gzip，样式、字体、图标与脚本均内联。鸣潮官方主视觉同源低优先级加载，AVIF 桌面约 49 KB、手机约 26 KB；遥控器无需等待背景。硬件照片只在原理页加载。

使用电脑 Chrome / Edge 或 Android Chrome，选择 `JFKJ-FBFB`。连接成功后会闪三次蓝灯，稍等即可操作。目前面向主板 **HE-750G24**、固件 **V4.1.8** 的研究样机，其他批次不保证兼容。

iPhone / iPad 的常规 Safari、Chrome 目前只能屏幕预览，网页不能直接连接蓝牙；本站不要求安装其他浏览器或 App。[兼容性说明](docs/SDK.md#浏览器兼容性)

三种玩法在首页同级展示：**原生灯效**由灯棒自主运行，包含呼吸、三色渐变与多色轮播；**延伸灯效**提供调速呼吸、心跳、烛光与自制配色；**音乐律动**直接选择音乐文件、标签页或麦克风。快速闪光仍需手动开启。

## 开发

网页、SDK 与研究资料都在这里，厂家固件和本机环境不随仓库分发。

- [SDK](docs/SDK.md) — 接入蓝牙、设色与断开连接。
- [原生灯效](docs/NATIVE-EFFECTS.md) — 呼吸、渐变、多色轮播与连续设色；[打开原生呼吸](https://wuwa.south-wall.com/?engine=native)。
- [观感混色](docs/COLOR-MIXING.md) — 色轮、色相映射与白光通道处理。
- [硬件实拍](docs/HARDWARE.md) · [控制协议](docs/PROTOCOL.md) — 辨认样机、GATT 帧与只读备份。
- [函数与证据](docs/FUNCTIONS.md) — 已知入口、参数含义与待验证项。
- [逆向环境](re/README.md) — 从自己的固件重建 Ghidra 工程。

本地打开控制台：

```bash
python3 -m http.server 8765 -d web
```

访问 [localhost:8765](http://localhost:8765)。Node 24 的 `npm test` 检查 SDK、混色与到访计数；`npm run build` 生成可部署的单文件首页。发布步骤见 [部署说明](docs/DEPLOYMENT.md)。

页头[到访计数](docs/VISITORS.md)按浏览器匿名去重，独立异步加载。控制和音频处理不依赖计数服务。

## 验证范围

原版控制台和命令行已有实物记录。本轮三原色、粉红与新版观感混色获得样机目测确认，原生单色呼吸获得用户「非常顺滑」的实物反馈；这不是仪器色度校准。完整的连接恢复和音乐同步仍需硬件回归，现场广播与未知固件命令尚未实测。详见 [验证记录](docs/VERIFICATION.md)。

## 许可

允许免费使用、修改、分享与托管；禁止销售软件、收费访问或托管，以及付费捆绑。采用 [Wuwa Lightstick Community License 1.0](LICENSE)，属于源码可用许可，不是标准开源许可。[中文说明](docs/LICENSING-OPTIONS.md)

随附字体、游戏美术和品牌图标的权利归属及使用说明见 [第三方材料说明](THIRD_PARTY.md)。

网页免费开放，源码的使用与分发条款见 [LICENSE](LICENSE)。本项目为独立研究与兼容工具，与游戏、演出主办方或硬件厂家无隶属关系。
