# 第三方材料

本项目的社区源码许可只覆盖其声明的原创材料。以下材料保留各自许可，不受本项目的禁止商业销售条款重新许可。

## D-DIN 字体

- 原作：Copyright (C) 2017 Datto Inc.，D-DIN 字体家族。
- 许可：[SIL Open Font License 1.1 全文](web/moonshade/OFL-D-DIN.txt)。部署副本位于 `/moonshade/OFL-D-DIN.txt`。
- 本仓库包含经过字符子集化和 WOFF2 转换的版本，主字体名为 **Wuwa UI Readout** 和 **Wuwa UI Expanded**。CSS 中的 D-DIN 名称仅用于匹配设计系统的内部字体别名。
- `web/moonshade/tokens.css` 内嵌这些字体；构建首页时移除未使用的 Expanded 字体。中文使用系统字体，无外部字体请求。

## MoonShade 样式

`web/moonshade/tokens.css` 与 `bundle.css` 是本项目采用的 MoonShade 网页样式快照。应用复用中性配色、字阶、间距、组件结构与原版字符画字标。字标由设计系统的原始字符矩阵生成单路径 SVG，以 142 × 33.6 的紧凑尺寸内联在页面中；不依赖终端字体或额外图片请求。不分发设计系统的内部文档。控件颜色、色轮和实物照片属于本产品的信息内容。

普通开发与构建无需访问原设计系统。维护者更新快照时，可使用 `scripts/sync_moonshade.py PROJECT_DIR SKILL_REFERENCES_DIR`；只有此刷新步骤需要 `fonttools[woff]`，部署构建只使用 Python 标准库。

## 硬件照片

四张照片由项目用户提供。网页版本只作缩放、转码与元数据清理；没有生成、补绘或推测被遮挡的细节。见[硬件实拍](docs/HARDWARE.md)。
