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

## 演出照片

说明页的两张演出照片由用户提供，位于 `web/assets/concert/`。只做 WebP 压缩与元数据清理，保留完整画面及原有标志；图片权利归相应权利人，项目代码许可证不重新许可图片。来源范围与尺寸见[配图记录](web/assets/concert/README.md)。照片展示演出效果，不作为无线协议或现场设备配置的证据。

## 鸣潮官方主视觉

- 来源：[鸣潮官网](https://wutheringwaves.kurogames.com/en/)使用的角色群像背景；[官方原始图片](https://wutheringwaves.kurogames.com/website-preface/assets/main-bg-c08dcefb.webp)，1920 × 1080，479,860 字节。来源路径可在官网的 `index-415d4999.js` 中核对，原始资产名为 `desktop/main-bg.webp`。
- 游戏美术的著作权归库洛游戏及相应权利人所有。官方发布不等于开放许可；本仓库不对这些美术授予社区源码许可，不声称官方合作或授权。
- 处理仅包括缩放、裁切、压缩和元数据清理，没有生成或补绘人物。桌面 1440 × 810；手机版取原图 `x=660, y=0, width=500, height=1080` 的竖向区域。页面用 CSS 遮罩保护文字可读性。

| 发布文件（`web/assets/artwork/`） | 字节 |
|---|---:|
| `wuwa-key-visual-2bf16e89.avif` | 48,834 |
| `wuwa-key-visual-0cc8a4a2.webp` | 89,284 |
| `wuwa-key-visual-mobile-c930edae.avif` | 25,527 |
| `wuwa-key-visual-mobile-64336493.webp` | 47,428 |

每个视口只加载适合自己的一个格式，不向库洛或其他图片服务发起访客请求。文件名含内容 SHA-256 的前八位，替换内容时同步更名，以便安全使用长期缓存。

## 社交品牌图标

bilibili、X、Instagram、GitHub 的 SVG 路径取自 [Simple Icons](https://github.com/simple-icons/simple-icons/tree/4672316908c58ef9342f3069fe7ebe50d30d45b2/icons)，固定版本 `4672316908c58ef9342f3069fe7ebe50d30d45b2`，采用 [CC0 1.0](https://github.com/simple-icons/simple-icons/blob/4672316908c58ef9342f3069fe7ebe50d30d45b2/LICENSE.md)。仅以内联单色图标标识用户提供的社交入口；图标对应品牌的商标权仍归各品牌所有，不表示赞助或关联。没有加载图标库、社交插件或第三方脚本。
