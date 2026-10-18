# Review: 1007 SVG export against dev

Reviewed on 2026-10-18. Branch: `kuanchou/1007_svg_export` at `0be2a4f25ad62a40ab2bc0ddbda50196b25cdce2`. Comparison: local `dev` at `4ebbf1ca578fc7e361d1e991441ada2cf66b5a50` (also the current local `origin/dev` reference). No remote fetch was performed.

The recent catalog scaling, beam clipping, color-blending visibility, empty-resource filtering, and allocation changes are present. The three annotation discrepancies from this review have now been fixed in the working tree; they affected SVG and the PDF generated from it.

## Findings

### 1. [Fixed] Ruler horizontal text offsets had the opposite sign

Location: `src/utilities/export/regionSvgExport.ts:447`.

The viewer sets the Konva text's `offsetX` to the user offset plus half the measured text width (`CompassAndRulerAnnotationComponent.tsx:529–535`). Konva subtracts that offset, so a positive horizontal offset moves the label left. SVG instead adds `offset.x` to the midpoint. This affects the hypotenuse label and both auxiliary labels whenever their horizontal offsets are nonzero; the discrepancy increases with export pixel ratio.

Reproduction: use a ruler whose rendered midpoint is x=450, set text offset X to 10, and export at pixel ratio 1. The viewer-equivalent center is x=440; the SVG text has x=460. A focused assertion of x=440 fails with x=460.

Fixed by subtracting the horizontal offset and retaining the existing vertical baseline adjustment.

### 2. [Fixed] Solid ruler auxiliary lines inherited the main line's dash pattern

Location: `src/utilities/export/regionSvgExport.ts:432–435`.

The ruler line helper first spreads `getStrokeAttrs(region, ...)`, which already includes the hypotenuse's dash array. It overrides that array only when the requested line's dash length is positive. Consequently, a dashed main ruler with auxiliary dash length zero exports all three lines as dashed. The viewer passes `region.auxiliaryLineDashLength` independently to the auxiliary lines (`CompassAndRulerAnnotationComponent.tsx:569,582`).

Reproduction: set main dash length to 8, auxiliary dash length to 0, and show auxiliary lines. Both auxiliary SVG polylines incorrectly retain `stroke-dasharray="8,8"`. A focused assertion that the auxiliary lines have no dash array fails.

Fixed by passing each ruler line's effective dash length through `getStrokeAttrs`; zero now leaves auxiliary lines solid.

### 3. [Fixed] Compass export ignored user-configured label offsets

Location: `src/utilities/export/regionSvgExport.ts:380–381` (placement helper at lines 323–335).

The appearance dialog exposes north/east X and Y offsets. The viewer renders the corresponding `northTextOffset` and `eastTextOffset` values, but SVG recomputes a fixed gap from the arrow tip and font size without reading either offset. Editing an offset after the automatic placement has settled changes the viewer and PNG, while SVG/PDF retains the automatic position.

Reproduction: export a compass, increase its north label X offset by 20, and export again without moving or resizing the compass. The SVG north label stays at x=500; the viewer-equivalent position should move left by 20 to x=480. A focused before/after assertion fails with x=500.

Fixed by converting stored Konva offsets and measured label dimensions into the SVG centered text position. The viewer's automatic placement and SVG export now share the same anchor/center conversion helpers.

## Refactoring suggestions

The shared anchor/center conversions now live in `src/utilities/region/annotationTextPosition.ts` and are used by compass placement in both the viewer and exporter. Ruler dash selection is explicit in the existing stroke-attribute helper. No broader annotation-renderer abstraction is needed.

The previous channel-map layout extraction, per-frame vector style resolver, catalog mapped-array reuse, and removal of typed-array copies are already implemented. They do not need to be repeated.

## Performance improvement suggestions

The remaining opportunities should be measured before implementation; this review did not establish a performance regression or a measured speedup.

- The dense contour path still calls `imageToCanvasPoint`/`imageToCanvasPos` for every vertex, recomputing constant view spans and allocating a result object. If profiling large spatially matched contour exports identifies this as material, precompute the affine canvas coefficients once per layer and reuse an output point. The recent contour endpoint snapshots already make reused transform outputs safe. Preserve the existing coordinate convention and invalid-point breaks.
- For very large vector overlays, consider emitting visible vectors directly into the SVG renderer instead of retaining `exportPositions` and `strokeColors` and then traversing them again. This would reduce peak intermediate storage, but only pursue it if measurements show that storage matters relative to raster encoding and the SVG DOM. Keep clipping, order, per-vector color, and intensity-square behavior intact.

## Verification and limits

- Existing targeted suite: **13 suites, 177 tests passed** across export utilities, image canvas composition, export orchestration, contour/vector stores, hotkeys, export menu, and channel-map layout.
- The existing targeted suite (177 tests) was run before these fixes; it does not cover the three cases above.
- `npx tsc --noEmit --pretty false`: passed after the fixes.
- `npm run check-eslint`: passed after the fixes.
- Prettier and `git diff --check`: passed after the fixes.
- The three focused reproductions from the review were not rerun after the fixes. No new automated tests were added or run during this implementation turn.
- No interactive browser comparison, real-WCS visual export, or end-to-end PDF rendering was performed in this pass. The annotation reproductions use the existing mocked AST test environment and the live viewer's placement/style rules as the reference.
- Preference schema work remains deferred to its separate PR.

Changes remain uncommitted. The review report and the annotation fixes are present in the working tree.
