# posh/cosmos source-detection runtime

Reference: `/Users/pshuang/Softwares/Source-detection`, branch `posh/cosmos`,
commit `5b83c44`.

The cosmos detector is the generic `OnnxDetector` configured in `main.ts` with:

- model: `/models/acdc_point_galaxy.onnx`
- classes: `point`, `galaxy`
- WebGPU disabled
- blob fallback disabled

## Viewport inference

1. Extract the currently visible scientific-pixel ROI.
2. Resample it to 640×640 with nearest-neighbour sampling.
3. Sort finite values, calculate `1.4826 × MAD` as the lower floor, and use
   the 99.5 percentile as the upper value.
4. Clamp-normalize pixels to 0–1 and copy the grayscale plane into every
   model input channel.
5. Decode either `[1,N,6]` or `[1,4+classes,anchors]` YOLO output.
6. Keep raw confidence ≥ `0.0001`, clamp boxes to 10–640 image pixels, retain
   at most the 1000 highest-confidence proposals, then run NMS.
7. NMS uses IoU 0.45. A child with raw confidence ≥ 0.90 instead uses IoU
   0.65. High-confidence proposals have sorting priority.
8. Blob detections are not merged into this ACDC path. The original
   `detectExtendedSources()` connected-region pass is used during
   post-processing to consolidate repeated ONNX proposals, but its coarse
   ellipses are not displayed.

## Post-processing and display

1. Preserve raw model confidence and map it for display with
   `min(0.99, 1 - exp(-raw × 50))`.
2. Fit intensity-weighted Gaussian moments from the original ROI pixels.
   The local background is the median of the proposal border and moments use
   the bright core above 12% of the peak signal.
3. A point ellipse uses 1σ radii; a galaxy ellipse uses 3σ radii. Nearly
   circular fits use the average radius. Position angle comes from the
   covariance eigenvectors.
4. Rank detections by Gaussian peak flux
   `flux / (2π sigmaMajor sigmaMinor)`.
5. Keep sources whose peak flux is at least 0.01% of the brightest detection,
   then group proposals with the original detector's connected extended
   regions. Keep the highest-peak fitted proposal in each region.
6. This region pass prevents Gaussian tails and repeated boxes around one
   source from becoming separate displayed detections. It also avoids a
   global confidence cutoff: valid extended sources can have low raw ONNX
   confidence while retaining peak flux comparable to compact sources.
7. Suppress smaller fitted ellipses whose centers are contained by an
   equally or more confident larger ellipse, then suppress candidates whose
   fitted ellipse centers overlap. This ports the original project's
   `bf5daae` (`remove overlap`) display filtering.
8. Apply the original 20-source display limit.
9. Draw the fitted ellipse and its numeric index, not the raw YOLO rectangle
   and confidence label.
