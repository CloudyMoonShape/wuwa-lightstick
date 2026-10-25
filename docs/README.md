# 开发文档

[共鸣](../README.md) · [打开控制台 ↗](https://wuwa.south-wall.com/) · [交互原理 ↗](https://wuwa.south-wall.com/principles)

## 开发与研究

| 文档 | 内容 |
|---|---|
| [SDK](SDK.md) | 从示例开始连接、设色；查阅接口和返回值 |
| [观感混色](COLOR-MIXING.md) | 了解色轮与颜色映射，调整黄色绿色比例 |
| [平滑调光](DIMMING.md) | 亮度百分比、滑块过渡、呼吸曲线与暗部限制 |
| [高发送率试验](OUTPUT-TIMING.md) | 60 / 90 / 120 档、独立采样、写入与回包计数 |
| [硬件实拍](HARDWARE.md) | 辨认灯板、主板、装配结构与 RGBW 通道 |
| [硬件与协议](PROTOCOL.md) | 查阅 GATT 和广播格式，读取自己的固件 |
| [函数与证据](FUNCTIONS.md) | 追踪固件入口，区分实测、推断与未知项 |
| [逆向环境](../re/README.md) | 重建 Ghidra 工程和反编译分析 |

## 发布与记录

| 文档 | 内容 |
|---|---|
| [部署](DEPLOYMENT.md) | 构建轻量静态站并发布到 Cloudflare Pages |
| [到访计数](VISITORS.md) | 浏览器匿名去重、数据库接入与计数边界 |
| [访问速度](PERFORMANCE.md) | 中国大陆联通直连实测、请求耗时与测量边界 |
| [展示审查](DESIGN-AUDIT.md) | 视觉、交互、移动端与仓库展示的三轮修正 |
| [验证](VERIFICATION.md) | 软件检查、实物记录和仍待验证的范围 |
| [色板审查](COLOR-AUDIT.md) | 从装饰色修正到观感混色的排查记录 |
| [许可](LICENSING-OPTIONS.md) | 免费分享、防倒卖与授权边界 |

厂家固件、第三方工具、反编译产物和本机环境不随仓库分发；重建步骤保留在相关文档中。
