import {ImageComponent} from "../ImageComponent";
import headSpatialButton from "static/help/head_spatial_button.png";
import headSpatialButton_d from "static/help/head_spatial_button_d.png";

export const SPATIAL_PROFILER_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={headSpatialButton} dark={headSpatialButton_d} width="90%" />
        </p>
        <p>
            Spatial profiler widget allows you to view a profile from a horizontal cut or a vertical cut at the cursor position in the image viewer. The cursor position may be fixed in the image viewer by pressing <code>F</code> key.
            Pressing again will unfreeze the cursor.
        </p>
        <p>The cursor position in the image viewer is displayed as a red vertical line in the spatial profile plot.</p>
        <p>
            When cursor is in the image viewer, the cursor position and pointed pixel value in image and world coordinates are reported at the bottom-left corner of the spatial profiler widget. When cursor moves into the spatial profile
            plot, numerical values of the profile at the cursor position (displayed as a grey vertical line) will be reported instead.
        </p>
        <h3 id="profile-mean-and-rms">Profile mean and RMS</h3>
        <p>
            As an option in the <code>Styling</code> tab of the spatial profiler settings dialog, mean and RMS values of the profile can be visualized as a green dashed line and a shaded area in the profile plot. Numerical values are
            displayed at the bottom-left corner. Note that CARTA includes all data in the current zoom level of the profile plot to perform the calculations. If zoom level changes, mean and RMS values will be updated too.
        </p>
        <h3 id="profile-smoothing">Profile smoothing</h3>
        <p>
            The displayed profile can be smoothed via the <code>Smoothing</code> tab of the spatial profiler settings dialog (the cog icon).
        </p>
        <h3 id="interactivity-zoom-and-pan">Interactivity: zoom and pan</h3>
        <p>The x and y ranges of the spatial profile plot can be modified by</p>
        <ul>
            <li>
                <code>scrolling wheel</code> (up to zoom in and down to zoom out with respect to the cursor position)
            </li>
            <li>
                <code>click-and-drag</code> horizontally to zoom in x
            </li>
            <li>
                <code>click-and-drag</code> vertically to zoom in y
            </li>
            <li>
                <code>click-and-drag</code> diagonally to zoom in both x and y
            </li>
            <li>
                <code>double-click</code> to reset x and y ranges
            </li>
            <li>
                <code>shift + drag-and-drop</code> to pan in x
            </li>
        </ul>
        <p>In addition, the x and y ranges can be explicitly set in the spatial profiler settings dialog.</p>
        <h3 id="exports">Profile plot export</h3>
        <p>The spatial profile plot can be exported as a png file or a text file in tsv format via the buttons at the bottom-right corner (shown when hovering over the plot).</p>
        <h3 id="plot-cosmetics">Plot cosmetics</h3>
        <p>
            The appearance of the spatial profile plot is customizable via the <code>Styling</code> tab of the spatial profiler settings dialog (the cog icon). Supported options are:
        </p>
        <ul>
            <li>color of the plot</li>
            <li>plot styles including steps (default), lines, and dots</li>
            <li>line width for steps or lines</li>
            <li>point size for dots</li>
            <li>display alternative horizontal axis in world coordinate</li>
        </ul>
        <br />
        <h4 id="note">NOTE</h4>
        <p>
            For performance reasons, a profile is min-max decimated before rendering if the number of points of the profile is greater than the screen resolution of the spatial profiler widget. The kernel size of profile decimation is
            dynamically adjusted so that profile features are mostly preserved. When decimation is applied, the line style of the profile plot is switched to &quot;line&quot;, regardless the setting in the spatial profiler settings dialog.
            When no decimation is applied (e.g., at higher profile zoom level, or profile has fewer points than the screen resolution), the line style becomes &quot;step&quot; (as default in the <code>Styling</code> tab of the settings
            dialog).
        </p>
    </div>
);
