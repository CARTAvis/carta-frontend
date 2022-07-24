export const SPATIAL_PROFILER_SETTINGS_COMPUTATION_HELP_CONTENT = (
    <div>
        <h3>Computation</h3>
        <p>
            The <code>Width</code> spinbox is used to define the averaging width along a line region or a polyline region when calculating a spatial profile. If the image is considered as <em>flat</em>, the width is in pixels. However, if the image is considered as <em>wide</em> with noticible projection distortion, the width is in unit angular step. This ensures adjacent samples along the region have approximatedly the same sky coverage.
        </p>
    </div>
);
