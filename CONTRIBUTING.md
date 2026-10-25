# Contribute

[简体中文](CONTRIBUTING.zh-CN.md)

Use the [SDK](docs/SDK.md) for browser control. Read the [function map](docs/FUNCTIONS.md) before you add firmware commands.

## Submit a change

1. Create a branch from the current `main`.
2. Make one focused change.
3. Run `npm test` and `npm run build`.
4. Update the English document and its Chinese translation.
5. Open a pull request. State what changed and how you checked it.

For device results, record the board, firmware version, input bytes, response bytes, and visible output. Include the date and steps. State which results came from hardware and which came from static analysis.

Do not submit firmware dumps, vendor tools, decompiled output, credentials, personal paths, or device identifiers. Use your own isolated device for tests. Do not send venue broadcasts at an event.

## Write clearly

English is the primary documentation language. Put Chinese translations in `docs/zh-CN/`. Root documents use the `.zh-CN.md` suffix. Keep the website interface in its current language unless a change explicitly adds localization.

Use short sentences and active verbs. Give each instruction one action. Use one term for each function. Keep warnings next to the relevant action. Use tables for parameters and diagrams for data flow. Delete captions that repeat a heading or image.

These conventions follow the intent of [ASD-STE100](https://www.asd-ste100.org/STE_faq.html). They do not claim formal vocabulary compliance or certification.

For technical terms, use **lightstick**, **frame**, **write**, **notification**, **native effect**, and **extended effect** consistently. Explain a new term before you use an abbreviation.

## Images

Capture the current page. Record its URL, date, viewport, and connection state. Do not present a screen preview as a device test. Remove obsolete screenshots from the current tree when you replace them.

Only add assets with a documented source and permission to redistribute them. The code license does not grant rights to game artwork or other third-party material.
