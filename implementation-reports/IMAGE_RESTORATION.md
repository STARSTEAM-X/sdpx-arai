# Illustration restoration · 2026-10-19

At the user's request, Imagegen restored two existing Figma illustrations:
the A/B hero (`175:26`) and classroom (`52:464`). These are AI derivatives,
with small changes to drawn details; original exports remain untouched.
Consumers use transparent WebP. The hero has 1260w / 1720w responsive sources.

Verified in the running port-5173 preview: the hero selects the new WebP,
and the classrooms banner loads the 1280px transparent replacement.
Desktop screenshots are in `evidence/image-restoration/`.

Validation: frontend typecheck, build and 29 unit tests passed.
The first unit run failed before collecting tests because Windows denied a
temporary cache rename; rerunning with TEMP/TMP inside `.local/image-tests-tmp`
passed. No dependencies or test expectations changed.

The welcome illustration was also tried twice with Imagegen, but visible
matte residue remained. Those outputs are not used; its Figma original remains.
Other illustrations and SVG icons keep their current assets.
