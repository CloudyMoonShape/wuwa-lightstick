# Public release review

[简体中文](zh-CN/PUBLIC-RELEASE.md)

Review date: 2026-10-24. The repository remains private. This review does not change its visibility.

## Complete

- English is the primary documentation language. Chinese translations have direct links to their source documents.
- The README uses the approved Resonator wordmark and current controller screenshot.
- Desktop, mobile, and principles screenshots show the deployed interface. See [capture details](screenshots/README.md).
- The local controller instructions build the shared header and footer before serving `dist/`.
- Protocol facts distinguish hardware observations from static analysis. No new device test is claimed.
- Manufacturer firmware, vendor tools, Ghidra projects, and decompiled output are excluded from the tracked tree.
- The ignore list covers environment files, local deployment overrides, firmware backups, and generated output.
- The license remains source-available. It permits free sharing and hosting but restricts paid distribution and access.

## Resolve before visibility changes

| Item | Finding | Required action |
|---|---|---|
| Old remote branch | `codex/wuwa-gold-before-upstream` still reaches pre-cleanup documentation with a private location reference. | Preserve any needed work, then remove or sanitize the obsolete branch. Recheck all remote refs. |
| Commit metadata | Earlier commits on `main` include personal and work email addresses. | Confirm that these addresses may be public, or rewrite the relevant author and committer metadata before publication. |
| Game assets | Wallpaper and the Tacet Mark-derived part of the logo have no recorded open redistribution license. Screenshots also contain these assets. | Record a valid basis for public redistribution, or replace the affected assets and screenshots. Attribution alone is not permission. |
| Supplied photos | Hardware and concert images were supplied by the owner. The repository has no separate authorship or redistribution record. | Confirm the relevant rights and document them. |

The old branch was not deleted. Git history was not rewritten. Repository visibility was not changed.

## Inspection scope

A local scan checked text blobs reachable from the three fetched remote branches. It checked private home paths, private IPv4 ranges, private-key markers, common access-token formats, and the previously removed location term. The 37 commits on `origin/main` at `0dc49ab` had no matches for these rules. The obsolete branch had three matching historical document blobs. `feat/device-guide` had no matches.

This is a targeted scan, not a guarantee that the repository contains no sensitive data. It does not cover deleted server objects, cached pull-request diffs, GitHub Actions logs, release attachments, or external services. Check those surfaces before publication. If data must be removed from cached GitHub views, follow [GitHub's removal procedure](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

`wrangler.jsonc` includes the current production database identifier. That identifier is not an access credential. It is retained to avoid disconnecting the live visitor service. For another deployment, start with `wrangler.example.jsonc` and use your own project and database. Do not deploy a copied production configuration without review.

## Final checks

1. Resolve the items in the table.
2. Run `npm test`, `npm run build`, and `python3 scripts/check_docs.py`.
3. Review the English and Chinese README on GitHub.
4. Recheck every remote branch and tag after cleanup.
5. Review asset permissions, GitHub attachments, and cached review material.
6. Change visibility only after the owner requests publication.
