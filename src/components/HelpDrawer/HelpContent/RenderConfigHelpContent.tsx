import {ImageComponent} from "../ImageComponent";
import headRenderconfigButton from "static/help/head_renderconfig_button.png";
import headRenderconfigButton_d from "static/help/head_renderconfig_button_d.png";

export const RENDER_CONFIG_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={headRenderconfigButton} dark={headRenderconfigButton_d} width="90%" />
        </p>
        <p>
            The render configuration widget controls how a raster image is rendered in color space. The widget contains a set of clip levels as buttons on the top. The clip boundaries are displayed in the <code>Clip Min</code> and{" "}
            <code>Clip Max</code> fields. These fields can be manually edited and the clip level will switch to <code>Custom</code>. The clip boundaries are visualized as two vertical lines (draggable) in red in the histogram.
        </p>
        <p>
            By default, a per-channel histogram is shown, and optionally a per-cube histogram can be displayed via the <code>Histogram</code> dropdown.
        </p>
        <p>
            Different scaling functions and colormaps can be chosen via the <code>Scaling</code> and <code>Color map</code> dropdowns, respectively. A color map might be inverted via the <code>Invert color map</code> toggle.
        </p>
        <p>
            Bias and contrast can be adjusted jointly via the 2D box (x as bias and y as contrast). The effective scaling function is visualized as a grey curve between the two red vertical lines. By default, smooth bias and contrast
            functions are applied so that the resulting scaling function is a smooth curve. You may disable this feature with the <code>Render configuration</code> tab of the preferences dialog.
        </p>
        <p>The appearance of the histogram plot can be configured through the render configuration settings dialog, including:</p>
        <ul>
            <li>color of the plot</li>
            <li>plot styles including steps (default), lines, and dots</li>
            <li>line width for steps or lines</li>
            <li>point size for dots</li>
            <li>display y in logarithmic scale (default)</li>
            <li>display mean and RMS</li>
            <li>display clip labels</li>
        </ul>
        <h3 id="interactivity-zoom-and-pan">Interactivity: zoom and pan</h3>
        <p>The x and y ranges of the histogram plot can be modified by</p>
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
        <p>In addition, the x and y ranges can be explicitly set in the render configuration settings dialog.</p>
    </div>
);
