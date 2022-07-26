export const SPATIAL_PROFILER_SETTINGS_COMPUTATION_HELP_CONTENT = (
    <div>
        <h3>Computation</h3>
        <p>
            The <code>Width</code> spinbox is used to define the averaging width along a line region or a polyline region when a spatial profile is calculated. If the image is considered to be <em>flat</em>, the width is in pixels. However,
            if the image is considered to be <em>wide</em> with noticeable projection distortion, the width is in unit angular step. This ensures that adjacent samples along the region have approximately the same sky coverage.
        </p>
    </div>
);
