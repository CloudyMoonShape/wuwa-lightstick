# 第三方材料

[English](THIRD_PARTY.md)

项目许可证只覆盖其范围内的原创材料。以下材料保留各自权利和许可条件。

## 字体

D-DIN 的版权为 © 2017 Datto Inc.，采用 [SIL Open Font License 1.1](web/moonshade/OFL-D-DIN.txt)。部署副本位于 `/moonshade/OFL-D-DIN.txt`。

仓库内嵌经过子集化和 WOFF2 转换的 **Wuwa UI Readout** 与 **Wuwa UI Expanded**。修改版不再以 D-DIN 作为字体家族名。字体位于 `web/moonshade/tokens.css`，控制页构建时移除未使用的 Expanded 字体。中文使用系统字体。

## MoonShade 与 Resonator 字标

`web/moonshade/tokens.css` 和 `bundle.css` 是随仓库提供的 MoonShade 样式快照。仓库不包含设计系统内部文档，常规构建不需要访问原设计系统。

页脚 MoonShade 字标由原始字符矩阵生成 SVG 路径。RESONATOR 字标采用 D-DIN Exp Bold 和同一组栅格参数：大写字高 15.5、字距 0.06、阈值 0.45、像素比例 1:2.1。

Resonator 组合标志在字标下方使用**源自声痕的轮廓**，参考图由项目作者提供。该轮廓与《鸣潮》相关，不能把组合标志描述为完全原创的项目美术。仓库没有确立对此游戏衍生图形的独立再分发或授权许可。详见[公开发布](docs/zh-CN/PUBLIC-RELEASE.md)。

共用页头内嵌组合标志，仓库副本位于 `docs/assets/resonator-dark.svg` 和 `docs/assets/resonator-light.svg`。SVG 不需要额外下载字体或调用图片服务。

维护者可用 `scripts/sync_moonshade.py PROJECT_DIR SKILL_REFERENCES_DIR` 刷新样式快照。此维护步骤需要 `fonttools[woff]`，常规部署构建只用 Python 标准库。

## 硬件与演出照片

四张硬件照片和两张演出照片由项目作者提供。网页副本经过缩放、压缩和元数据清理，没有生成图片或补绘遮挡部分。

参见[硬件](docs/zh-CN/HARDWARE.md)和[演出图片记录](web/assets/concert/README.md)。演出照片只展示现场环境，不证明无线协议或现场设备配置。

仓库没有逐张照片的作者身份与再分发权利声明。不能因为持有文件就推定拥有这些权利。软件许可证不重新授权照片。这是待核实的公开发布事项，不是侵权结论。

## 鸣潮美术

背景来自[鸣潮官网](https://wutheringwaves.kurogames.com/en/)。已记录的[原图](https://wutheringwaves.kurogames.com/website-preface/assets/main-bg-c08dcefb.webp)为 1920 × 1080 像素、479,860 字节。记录中的官网脚本为 `index-415d4999.js`，源资产名为 `desktop/main-bg.webp`。上游路径可能变化。

著作权属于库洛游戏及相应权利人。官网发布不等于开放许可。仓库不声称官方背书或再分发授权。仅署名不能解决发布副本的许可问题。

处理仅包含缩放、裁切、压缩和元数据清理。桌面副本为 1440 × 810。手机版采用原图坐标 `x=660, y=0, width=500, height=1080`。CSS 遮罩保证文字对比度。

| `web/assets/artwork/` 中的文件 | 字节 |
|---|---:|
| `wuwa-key-visual-2bf16e89.avif` | 48,834 |
| `wuwa-key-visual-0cc8a4a2.webp` | 89,284 |
| `wuwa-key-visual-mobile-c930edae.avif` | 25,527 |
| `wuwa-key-visual-mobile-64336493.webp` | 47,428 |

每个视口从同源加载一种受支持的格式，不向库洛请求图片。文件名采用内容 SHA-256 的前八位。替换素材时同步更名，保证长期缓存有效。

仓库截图也显示这些美术，应与原素材一并检查公开发布权利。

## 社交图标

bilibili、X、Instagram、GitHub 的 SVG 路径来自 [Simple Icons](https://github.com/simple-icons/simple-icons/tree/4672316908c58ef9342f3069fe7ebe50d30d45b2/icons)，版本 `4672316908c58ef9342f3069fe7ebe50d30d45b2`，采用 [CC0 1.0](https://github.com/simple-icons/simple-icons/blob/4672316908c58ef9342f3069fe7ebe50d30d45b2/LICENSE.md)。

图标仅用于标识社交入口。商标权属于各自权利人，不表示赞助。网站内嵌 SVG 路径，不加载图标库或社交插件。
