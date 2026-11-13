# Archived Chrome Web Store version evidence, 12 November 2026

Seven archived Chrome Web Store listings establish dated metadata for the
exact Gopher Premium, ClassLink Analytics+, and ClassLink OneClick IDs.
The stored pages contain no version-specific package links.

| Listing | Archive date | Version | Store's Updated field |
| --- | --- | --- | --- |
| [Gopher Premium](https://web.archive.org/web/20250710195548id_/https://chromewebstore.google.com/detail/gopher-buddy-for-gopher-f/becdplfalooflanipjoblcmpaekkbbhe/) | 10 July 2025 | 1.0.0.15 | 21 April 2025 |
| [ClassLink Analytics+](https://web.archive.org/web/20250710195607id_/https://chromewebstore.google.com/detail/classlink-analytics%2B/ihidolefpgnimlmgfljonacidpkmbhcl) | 10 July 2025 | 0.6.2 | 1 September 2024 |
| [ClassLink OneClick](https://web.archive.org/web/20240118053332id_/https://chromewebstore.google.com/detail/classlink-oneclick-extens/jgfbgkjjlonelmpenhpfeeljjlcgnkpe) | 18 January 2024 | 10.8 | 2 December 2022 |
| [ClassLink OneClick](https://web.archive.org/web/20240521013535id_/https://chromewebstore.google.com/detail/classlink-oneclick-extens/jgfbgkjjlonelmpenhpfeeljjlcgnkpe) | 21 May 2024 | 12.2 | 8 May 2024 |
| [ClassLink OneClick](https://web.archive.org/web/20240616124023id_/https://chromewebstore.google.com/detail/classlink-oneclick-extens/jgfbgkjjlonelmpenhpfeeljjlcgnkpe) | 16 June 2024 | 12.2 | 8 May 2024 |
| [ClassLink OneClick](https://web.archive.org/web/20241208103711id_/https://chromewebstore.google.com/detail/classlink-oneclick-extens/jgfbgkjjlonelmpenhpfeeljjlcgnkpe/) | 8 December 2024 | 12.3 | 24 August 2024 |
| [ClassLink OneClick](https://web.archive.org/web/20250311220629id_/https://chromewebstore.google.com/detail/classlink-oneclick-extens/jgfbgkjjlonelmpenhpfeeljjlcgnkpe) | 11 March 2025 | 12.5 | 21 January 2025 |

The 12.5 store Updated field differs from the previously recorded mirror
timestamp of 17 December 2024. Both values are retained with their source.

## Package acquisition

The known mirror download pattern supplied nine candidate URLs. All nine
returned HTTP 404 and had no captures in their exact Wayback searches.

| Extension | Candidate versions |
| --- | --- |
| Gopher Premium | 1.0.0.12 |
| ClassLink Analytics+ | 0.5.04, 0.6.0, 0.6.1, 0.6.2 |
| ClassLink OneClick | 12.2, 12.3, 12.5, 12.6 |

The storefronts refer to the generic Google update feed. Its archived
October 2010 response has a protocol 2.0 envelope and a day-start value
with no app or package entry. The recovered listings establish version
metadata. Historical package bytes still require an authenticated archive
or retained Chrome installation. [Generic feed capture](https://web.archive.org/web/20101026103732id_/https://clients2.google.com/service/update2/crx/)

## Evidence and reproduction

Wayback MCP returned captures for seven searches and empty results for
21. The scope includes current and legacy storefront slugs, publisher
support, mirror leads, and update feeds. The seven relevant storefront
responses exceeded the MCP body limit. Direct archive GETs retained each
body at the requested timestamp. The offline parser checks each retained
file against its delivery hash before reading the extension ID and
visible listing metadata.

From the Civil root:

```powershell
bun extensions/filter-audit-2026-11-11/new-vendor-history/fetch-storefront-history.ts
bun extensions/filter-audit-2026-11-11/new-vendor-history/fetch-storefront-history.ts --later
node extensions/filter-audit-2026-11-11/new-vendor-history/read-storefront-history.cjs
```

The first two commands require network access. The source bodies, Wayback
receipts, HTTP receipts, and `storefront-metadata.json` are in
`extensions/filter-audit-2026-11-11/new-vendor-history/`. The authenticated
package count is unchanged.
