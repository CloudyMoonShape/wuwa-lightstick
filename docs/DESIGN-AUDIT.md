# Design audit

[Documentation](README.md) · [简体中文](zh-CN/DESIGN-AUDIT.md)

The controller puts connection and light control first. The principles page explains the device. The repository provides the implementation and evidence.

## Current layout

- The header uses the RESONATOR wordmark above a compressed Tacet Mark. Overlapping pixels are cut out. Both pages use the same header and footer source.
- The controller header aligns with the outer edges of its control panels. The principles header aligns with its text and image column.
- The visitor count sits to the right of the logo on narrow screens.
- Native effects, extended effects, and music have equal navigation priority.
- Fixed native presets disable controls that do not apply. Fast flashing requires an explicit opt-in.
- Social links use named, keyboard-accessible SVG icons. They open in a new tab.
- The footer centers the MoonShade mark, document links, and creator credit. The flashing warning occupies its own row.

Keep instructions near the action that needs them. Remove labels that repeat the heading or control name. Use layout and spacing to show groups.

## Visual system

The site uses a bundled MoonShade style snapshot: neutral colors, fixed spacing, clear type roles, and terminal-style marks. Control colors carry information. The game artwork and gold visitor count are project-specific additions.

The official wallpaper is a compressed, same-origin background. It loads at low priority and cannot intercept input. Solid control panels preserve legibility. Font subsets and icons are embedded; the controller has no third-party font or script request.

The website supports Chinese, English, and Japanese. A compact language pill shares the social-link row. The repository has three language entry points. Screenshots capture each actual translation. All range controls use a 44 px thumb target inside a 48 px input area.

## Images

| File | Purpose |
|---|---|
| [controller-desktop-en.png](screenshots/controller-desktop-en.png) | Current controller layout. |
| [controller-mobile-en.png](screenshots/controller-mobile-en.png) | Narrow-screen hierarchy and controls. |
| [principles-desktop-en.png](screenshots/principles-desktop-en.png) | Explanation page and hardware imagery. |

Screenshots demonstrate layout. They do not prove that a lightstick was connected or an effect was measured. Do not place a fabricated visitor count in a production screenshot.

## Review method

Check desktop and narrow layouts after changes to shared page structure. Compare the logo, main content, and right-hand action edges. Check both light and dark themes when a color changes. Check keyboard focus and the disabled state when a control changes.

Use the built site for review. Serving `web/` directly bypasses the shared header and footer build step.

Earlier reviews covered 320, 375, 768, 1440, and 2560 px layouts across several revisions. They found and fixed overflow, focus, and layout issues. These historical checks do not establish that every later revision passed the same matrix. See [Verification](VERIFICATION.md) for evidence limits.

The award references were design goals, not certifications or award results.
