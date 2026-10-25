# Language selection

[Documentation](README.md) · [简体中文](zh-CN/LOCALIZATION.md) · [日本語](ja/QUICKSTART.md)

The controller and principles page support Chinese, English, and Japanese. Translations are included in the page build. Selecting a language does not request another language file.

## Selection order

The page uses the first available setting:

1. A supported `lang` query value: `zh`, `en`, or `ja`.
2. The user's saved manual choice.
3. The first supported language in `navigator.languages`.
4. English.

Browser language tags use their language prefix. For example, `zh-TW` selects Chinese, `en-GB` selects English, and `ja-JP` selects Japanese. The current Chinese translation uses Simplified Chinese. Unsupported values are ignored.

Use these URLs to share a specific language:

- [Chinese](https://wuwa.south-wall.com/?lang=zh)
- [English](https://wuwa.south-wall.com/?lang=en)
- [Japanese](https://wuwa.south-wall.com/?lang=ja)

The same query works on `/principles`. An explicit query takes priority over a saved choice. Remove it when you want to test browser-language selection.

## Manual selection

The language control updates the visible text and the `lang` query without reloading the page. It does not disconnect the lightstick or restart playback. The browser saves the choice in local storage when storage is available.

If storage is unavailable, selection still works on the current page. The query also identifies the selected language. A later visit without that query cannot rely on a choice that was not saved.

Language selection does not change the Bluetooth protocol, color values, or effect parameters. Protocol names, device names, command bytes, and user-provided filenames remain unchanged.

## Check a change

Use the built site. Test these cases with an isolated browser profile so that a saved choice does not hide a fallback error.

| Input | Expected language |
|---|---|
| `?lang=ja`, with saved English | Japanese |
| No supported query, with saved Chinese | Chinese |
| No saved choice; browser list `fr-FR`, `ja-JP`, `en-US` | Japanese |
| No saved choice; browser list `de-DE`, `en-GB` | English |
| No saved choice; browser list `zh-TW`, `en-US` | Simplified Chinese |
| No saved choice; no supported browser language | English |
| Unsupported query such as `?lang=fr` | Continue to the saved choice or browser list |
| Local storage unavailable | Use the query or browser fallback; manual selection still works |

Also check both pages in all three languages. Inspect narrow layouts, long labels, selected options, status messages, accessibility names, and image descriptions. Change the language during playback and confirm that the connection and effect remain active.

The table defines expected behavior. It is not a record that every browser or physical device passed these checks.

## Repository languages

The root README has [English](../README.md), [Chinese](../README.zh-CN.md), and [Japanese](../README.ja.md) versions. Technical reference documents have English and Chinese versions. The [Japanese documentation index](ja/README.md) includes a Japanese quick start and identifies links to English references. It does not imply that every technical document has a Japanese translation.
