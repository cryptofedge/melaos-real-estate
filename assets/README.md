# Brand assets

Derived from `Melaos logo (1)-Photoroom.png` — the transparent-background export of
the official lockup.

| File | What it is | Used by |
| --- | --- | --- |
| `logo.svg` | The mark as vector, 29 KB, gradient-filled | Header and footer lockups |
| `logo.png` | Same mark rasterised, 512×512 | Raster fallback, favicon source |
| `logo-full.png` | Full lockup, mark over wordmark, 1200px | Open Graph share image |
| `favicon.png` | Mark on a rounded ink tile, 256×256 | Browser tab, Apple touch icon |
| `favicon.ico` | 32×32 | Legacy browsers |

## How logo.svg was made

The lockup was cropped to the mark by finding the band of empty rows between it and
the wordmark. The alpha channel was thresholded to a silhouette, upscaled 2× so the
curve fitter had clean edges, and traced with vtracer in binary mode. Tracing in
colour mode instead produced a 2.4 MB file — the bevel shading explodes into hundreds
of stacked layers — so the shading is reproduced with a single linear gradient whose
three stops are sampled from the darkest, median and lightest gold in the original.

The result was verified by rasterising it in a browser and comparing coverage against
the source artwork pixel by pixel: **99.2% intersection-over-union**, with the star
correctly preserved as a knockout.

Note that vtracer positions each contour with its own `transform="translate(x,y)"` and
writes path data relative to that origin. Extracting only the `d` attributes collapses
every contour onto 0,0 — keep the whole element.

## Replacing these

Both lockups read `logo.svg`. If it fails to load they fall back to the `#brandMark`
vector symbol near the top of `index.html`. Swap in a designer-supplied SVG at the same
path and nothing else needs to change.

The star in the mark is a knockout — it shows whatever sits behind it. Both lockups and
the favicon place it on an ink tile to match the original artwork on black. On a light
background the star fills white and largely disappears.
