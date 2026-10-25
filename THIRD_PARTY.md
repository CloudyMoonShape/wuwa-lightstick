# Third-party materials

[简体中文](THIRD_PARTY.zh-CN.md)

The project license covers only the original material within its scope. The materials below retain their separate rights and license terms.

## Fonts

D-DIN is copyright © 2017 Datto Inc. It uses the [SIL Open Font License 1.1](web/moonshade/OFL-D-DIN.txt). The deployed copy is at `/moonshade/OFL-D-DIN.txt`.

The repository embeds subsetted WOFF2 fonts under the names **Wuwa UI Readout** and **Wuwa UI Expanded**. The modified fonts do not retain D-DIN as their family name. They are embedded in `web/moonshade/tokens.css`. The controller build omits the unused Expanded font. Chinese text uses system fonts.

## MoonShade and Resonator marks

`web/moonshade/tokens.css` and `bundle.css` are the bundled MoonShade style snapshot. The repository does not contain the design system's internal documents. Normal builds do not need the original design system.

The MoonShade footer mark uses the original character matrix rendered as an SVG path. The RESONATOR wordmark uses D-DIN Exp Bold with the same raster settings: capital height 15.5, tracking 0.06, threshold 0.45, and pixel aspect ratio 1:2.1.

The combined Resonator logo places a **Tacet Mark-derived silhouette** below the wordmark. The project owner supplied the reference image. The silhouette is associated with Wuthering Waves; the combined logo must not be described as wholly original project artwork. This repository does not establish a separate permission to redistribute or license the game-derived shape. See [Public release](docs/PUBLIC-RELEASE.md).

The shared header embeds the combined mark. Repository copies are in `docs/assets/resonator-dark.svg` and `docs/assets/resonator-light.svg`. The SVGs do not require a downloaded font or an image service.

Maintainers can refresh the style snapshot with `scripts/sync_moonshade.py PROJECT_DIR SKILL_REFERENCES_DIR`. That maintenance step needs `fonttools[woff]`. The normal deployment build uses the Python standard library.

## Hardware and concert photos

The project owner supplied four hardware photos and two concert photos. Web copies were resized, compressed, and stripped of metadata. They were not generated or used to reconstruct hidden details.

See [Hardware](docs/HARDWARE.md) and the [concert asset record](web/assets/concert/README.md). The concert photos illustrate the setting. They do not prove a radio protocol or a venue hardware configuration.

The repository does not contain a documented statement of authorship and redistribution rights for each supplied photo. Do not infer those rights from possession of a file. The software license does not relicense the photos. This is an unresolved publication check, not a finding of infringement.

## Wuthering Waves artwork

The current background is the “To the New World” concert key visual supplied by the maintainer. The [source image](https://pbs.twimg.com/media/HGGg_HmboAAq81-?format=jpg&name=4096x4096) is 3072 × 1728 pixels. The same concert artwork appears in the [official concert announcement](https://wutheringwaves.kurogames.com/jp/main/news/detail/4929).

Copyright remains with Kuro Games and the respective rights holders. Publication is not an open license. The software license does not relicense this artwork or imply endorsement.

Copies are resized, compressed, and stripped of metadata. Desktop uses 1440 × 810; mobile uses 960 × 540 with CSS positioning. Both retain the original image composition. CSS overlays preserve text contrast.

| File in `web/assets/artwork/` | Bytes |
|---|---:|
| `wuwa-concert-desktop-5c336cf1.webp` | 122,402 |
| `wuwa-concert-mobile-f3b1a20c.webp` | 59,952 |

The browser loads one same-origin image at low priority. It makes no request to X or Kuro Games. Content hashes prevent stale cached backgrounds.

Earlier repository screenshots may show the previous game key visual from the [official site](https://wutheringwaves.kurogames.com/en/). Its rights remain with the original rights holders.

## Social icons

The bilibili, X, Instagram, and GitHub SVG paths come from [Simple Icons](https://github.com/simple-icons/simple-icons/tree/4672316908c58ef9342f3069fe7ebe50d30d45b2/icons), revision `4672316908c58ef9342f3069fe7ebe50d30d45b2`, under [CC0 1.0](https://github.com/simple-icons/simple-icons/blob/4672316908c58ef9342f3069fe7ebe50d30d45b2/LICENSE.md).

The icons identify social links. Trademark rights remain with their owners. Their presence does not indicate sponsorship. The site embeds the SVG paths and loads no icon library or social plug-in.
