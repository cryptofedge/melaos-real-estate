# Brand assets

Extracted from `Melaos logo (1)-Photoroom.png` — the transparent-background export
of the official lockup.

| File | What it is | Used by |
| --- | --- | --- |
| `logo.png` | The mark alone, 512×512, transparent, centred with 6% padding | Header and footer brand lockups |
| `logo-full.png` | Full lockup, mark over the wordmark, 1200px wide | Open Graph share image |
| `favicon.png` | Mark on a rounded ink tile, 256×256 | Browser tab, Apple touch icon |
| `favicon.ico` | 32×32 fallback | Legacy browsers |

The star in the mark is knocked out — it reads as whatever sits behind it. That is why
both brand lockups place it on an ink tile, matching the original artwork on black.
Put it on a light background and the star fills with white.

## Replacing these

Drop a new `logo.png` in and both lockups pick it up with no code change. If the file
ever fails to load, the header and footer fall back to the `#brandMark` vector symbol
defined near the top of `index.html`.

An SVG export of the mark would be better than PNG at these sizes — the mark renders at
36px in the header, where the fine bevels alias. If you get one from the designer, save
it as `logo.svg` and update the two `<img src>` references.
