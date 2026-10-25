# Deploy

[Documentation](README.md) · [简体中文](zh-CN/DEPLOYMENT.md)

Build the site before you serve or upload it. The build inserts the shared header and footer. It also puts the controller code, styles, and font subset in one HTML file.

## Local preview

Use Node.js 24 and Python 3. From the repository root, run:

```sh
npm test
npm run build
python3 -m http.server 8765 -d dist
```

Open [localhost:8765](http://localhost:8765). A static preview does not need Cloudflare credentials. The visitor counter does not register visits on localhost.

## Cloudflare Pages

The current site uses Direct Upload. Set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in your shell. Use your own account and a token with the required Pages permissions. Do not commit their values.

For a new project, run:

```sh
npx wrangler@4.152.0 pages project create YOUR_PROJECT --production-branch main
```

After each build, run:

```sh
npx wrangler@4.152.0 pages deploy dist --project-name YOUR_PROJECT --branch main
```

Upload `dist/`, not the repository root. Wrangler compiles the root `functions/` directory separately. The build copies only the selected public assets. It excludes firmware, local environments, downloaded tools, and credentials.

The build prints the current HTML size and a gzip estimate. Use that output for the current revision. Do not treat a previous size measurement as the current payload or as a load-time guarantee.

## Optional visitor counter

The controller works without the counter. To enable it, create your own D1 database and apply the migration. Bind it as `VISITORS_DB` in the Pages production environment. Keep the production database out of preview environments.

Use [wrangler.example.jsonc](../wrangler.example.jsonc) as a starting point for your own deployment. Replace the example values before use. Do not reuse the project's production database binding.

Update the production database configuration and both origin lists in `web/visitors.js` and `functions/api/visitors.js`. See [Visitor counter](VISITORS.md). D1 setup needs database permissions in addition to Pages deployment permissions.

Only `/api/visitors` enters the function. The other paths remain static. Counter failure must not block the controller.

## Domain and assets

Add a custom domain to the Pages project before you configure its DNS record. Wait for domain verification and the certificate to become active. Then open the domain in a browser. See [Cloudflare custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/).

A new domain is a new browser origin. Users must select their Bluetooth device again. Saved settings do not move between origins.

The background is a separate, low-priority, same-origin request. It does not block the controls. Hardware and concert photos load on the principles page. Before you redistribute these files, review [Third-party materials](../THIRD_PARTY.md).

Artwork filenames contain a content hash and use long-lived caching. If you replace an image, update its filename, HTML references, and build allowlist together.

## Check a release

1. Run the tests and build.
2. Inspect `dist/` for unintended files.
3. Deploy the build.
4. Check the production home page, principles page, license, and referenced assets.
5. Compare their content with the local build.
6. Check the browser console, desktop layout, and narrow layout.
7. Test the changed controls on a real lightstick when the change affects device behavior.

A successful upload does not prove that the deployed site or hardware works. See [Verification](VERIFICATION.md).

[Cloudflare Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/) documents the deployment method. A Direct Upload project cannot switch directly to Git integration; use a new project if you need that workflow.

## Maintainer deployment

Resonator belongs to the personal Cloudflare account. Never deploy it to the company account. On the maintainer Mac, run every Wrangler command through the account wrapper:

```sh
~/.codex/skills/cloudflare/scripts/cfw.sh personal pages deploy dist --project-name wuwa-resonator --branch main
```

If personal account access fails, stop and fix that access. Do not use company credentials. The production D1 database is `resonator-visitors`.
