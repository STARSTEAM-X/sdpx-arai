# Restored Figma illustrations

These are AI-restored derivatives requested by the project owner on 2026-10-19,
not untouched Figma exports. Originals remain in `../figma/`.

| Asset | Original | Output |
| --- | --- | --- |
| hero-comparison | Figma `175:26`, `../figma/hero-comparison.png` | Transparent WebP, 1260 × 669 and 1720 × 913 |
| classroom | Figma `52:464`, `../figma/classroom.png` | Transparent WebP, 1280 × 960 |

The hero SVG exported from Figma contains a 640 × 256 raster image;
exporting that layer at 2x does not recover missing details. Imagegen was used
to restore edges and detail while retaining the characters, palette and composition.
Small drawn details differ from the originals. Source PNGs retain the generated output.

WebP files preserve alpha. The hero uses width-based `srcset` so the browser
can select the larger file for high-density screens. Layout dimensions stay unchanged.
Other Figma illustrations and vector assets retain their original exports.
