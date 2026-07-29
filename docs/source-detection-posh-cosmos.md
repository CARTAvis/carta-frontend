# posh/cosmos ACDC source-detection runtime

Reference: `/Users/pshuang/Softwares/Source-detection`, branch `posh/cosmos`,
commit `5b83c44`.

The runtime uses the generic `OnnxDetector` configuration from the reference
project's `ONNX` path:

- model: `/models/acdc_point_galaxy.onnx`
- classes: `point`, `galaxy`
- WebGPU disabled
- blob fallback disabled

## Viewport inference

1. Extract the currently visible scientific-pixel ROI.
2. Resample it to 640×640 with nearest-neighbour sampling.
3. Exclude CARTA blank pixels (`-FLT_MAX`), calculate `1.4826 × MAD` as the
   lower floor, and use the 99.5 percentile as the upper value.
4. Clamp-normalize pixels to 0–1 and copy the grayscale plane into every
   model input channel.
5. Decode either `[1,N,6]` or `[1,4+classes,anchors]` YOLO output.
6. Keep raw confidence ≥ `0.0001`, clamp boxes to 10–640 image pixels, retain
   at most the 1000 highest-confidence proposals, then run NMS.
7. NMS uses IoU 0.45. A child with raw confidence ≥ 0.90 instead uses IoU
   0.65. High-confidence proposals have sorting priority.
8. Return only the ACDC ONNX results at every zoom level. The obsolete
   connected-component/extended detector is not run.

## Post-processing and display

1. Preserve raw model confidence and map it for display with
   `min(0.99, 1 - exp(-raw × 50))`.
2. Fit intensity-weighted Gaussian moments from the original ROI only to
   calculate integrated and peak flux.
3. Match the reference ACDC `source: "onnx"` display path by replacing the
   raw proposal ellipse with fitted Gaussian moments: point regions use 1σ
   radii and galaxy regions use 3σ radii.
4. Hide a point proposal when its centre is inside a model-produced galaxy
   ellipse, matching `filteredDetections()`.
5. For both point and galaxy sources, require raw model confidence ≥1% and
   fitted Gaussian peak flux ≥1% of the brightest detected peak.
6. Compute average flux using the reference formula
   `Gaussian total flux / (π radiusX radiusY)` and require at least 0.01% of
   the highest average flux among the remaining candidates.
7. Label ellipses with their detected class (`point` or `galaxy`) rather than
   a numeric sequence.
8. Remove repeated regions using the reference project's raw-confidence and
   region-size priority followed by ellipse-centre containment. Galaxy pairs
   also use the reference 0.35 IoU consolidation threshold. Apply suppression
   only within the same detected class, so a galaxy cannot erase resolved
   point sources.
9. Do not apply extended-region representative selection.
