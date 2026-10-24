# 第三方材料

本项目的社区源码许可只覆盖其声明的原创材料。以下材料保留各自许可，不受本项目的禁止商业销售条款重新许可。

## D-DIN 字体

- 原作：Copyright (C) 2017 Datto Inc.，D-DIN 字体家族。
- 许可：[SIL Open Font License 1.1 全文](web/moonshade/OFL-D-DIN.txt)。部署副本位于 `/moonshade/OFL-D-DIN.txt`。
- 本仓库包含经过字符子集化和 WOFF2 转换的版本，主字体名为 **Wuwa UI Readout** 和 **Wuwa UI Expanded**。CSS 字体名同样使用改后的名称，不沿用保留字体名 D-DIN。
- `web/moonshade/tokens.css` 内嵌这些字体；构建首页时移除未使用的 Expanded 字体。中文使用系统字体，无外部字体请求。

## MoonShade 样式

`web/moonshade/tokens.css` 与 `bundle.css` 是本项目采用的 MoonShade 网页样式快照。应用复用中性配色、字阶、间距、组件结构与原版字符画字标。字标由设计系统的原始字符矩阵生成单路径 SVG，以 142 × 33.6 的紧凑尺寸内联在页面中；不依赖终端字体或额外图片请求。不分发设计系统的内部文档。控件颜色、色轮和实物照片属于本产品的信息内容。

普通开发与构建无需访问原设计系统。维护者更新快照时，可使用 `scripts/sync_moonshade.py PROJECT_DIR SKILL_REFERENCES_DIR`；只有此刷新步骤需要 `fonttools[woff]`，部署构建只使用 Python 标准库。

## 硬件照片

四张照片由项目用户提供。网页版本只作缩放、转码与元数据清理；没有生成、补绘或推测被遮挡的细节。见[硬件实拍](docs/HARDWARE.md)。

## 金色水波摄影

- 摄影：emteekay，《Waves》，2023-09-29，作品 ID `YWQTWtMk0Cw`。
- [原始作品](https://unsplash.com/photos/a-black-and-yellow-photo-of-water-ripples-YWQTWtMk0Cw) · [Unsplash License](https://unsplash.com/license)。它是独立摄影作品，不是鸣潮官方游戏素材。
- 发布文件：`web/assets/artwork/gold-ripples.avif`（1280 宽，36,499 字节）与 `gold-ripples.webp`（960 宽，48,582 字节）。通过 Unsplash 图片服务缩放与转码，页面以 CSS 降低饱和度、淡化左上区域；没有补绘。
- 图片随站点同源分发，不向 Unsplash 发起访客请求。各格式作为同一背景的替代资源，不作为独立图库出售或重新许可。

## 社交品牌图标

bilibili、X、Instagram、GitHub 的 SVG 路径取自 [Simple Icons](https://github.com/simple-icons/simple-icons/tree/4672316908c58ef9342f3069fe7ebe50d30d45b2/icons)，固定版本 `4672316908c58ef9342f3069fe7ebe50d30d45b2`，采用 [CC0 1.0](https://github.com/simple-icons/simple-icons/blob/4672316908c58ef9342f3069fe7ebe50d30d45b2/LICENSE.md)。仅以内联单色图标标识用户提供的社交入口；图标对应品牌的商标权仍归各品牌所有，不表示赞助或关联。没有加载图标库、社交插件或第三方脚本。
