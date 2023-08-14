import widgetButtonHistogram from "static/help/widgetButton_histogram.png";
import widgetButtonHistogram_d from "static/help/widgetButton_histogram_d.png";

import {ImageComponent} from "../ImageComponent";

export const HISTOGRAM_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={widgetButtonHistogram} dark={widgetButtonHistogram_d} width="90%" />
        </p>
        <p>
            The histogram widget displays a histogram plot based on the selections in the <code>Image</code>, <code>Region</code>, and <code>Polarization</code> dropdown menus. When there is no region or no active region, the entire image
            is used to compute the histogram.
        </p>
        <p>
            By default, the number of histogram bins is determined by the geometric mean of the region size or the image size if there is no active region for histogram computation. In the Configuration tab of the settings dialog, you can
            have fine controls of how a histogram is computed, including bounds (text input) and number of bins (slider).
        </p>
        <h3 id="image">Image</h3>
        <p>
            The <code>Image</code> dropdown menu defaults to &quot;Active&quot; image which means the current image in the image viewer if it is in the single-panel mode. If it is in the multi-panel mode, the active image is highlighted
            with a red box.
        </p>
        <h3 id="region">Region</h3>
        <p>
            The <code>Region</code> dropdown menu defaults to &quot;Active&quot; region which means a selected region in the image viewer. You can select a region by clicking on one in the image viewer, or by clicking on a region entry in
            the region list widget. The histogram plot of the selected region will be updated accordingly. When there is no region or no region is selected (active), the entire image is used to compute the histogram.
        </p>
        <h3 id="polarization">Polarization</h3>
        <p>
            The <code>Polarization</code> dropdown menu defaults to &quot;Current&quot; which means the selection as in the animator widget. Besides the Stokes components as defined in the image header, computed components such as linear
            polarization intensity, or polarization angle, etc., are also available.
        </p>
        <h3 id="interactivity-zoom-and-pan">Interactivity: zoom and pan</h3>
        <p>The x and y ranges of the histogram plot can be modified by</p>
        <ul>
            <li>
                <code>scrolling wheel</code> (up to zoom in and down to zoom out with respect to the cursor position)
            </li>
            <li>
                <code>drag-and-drop</code> horizontally to zoom in x
            </li>
            <li>
                <code>drag-and-drop</code> vertically to zoom in y
            </li>
            <li>
                <code>drag-and-drop</code> diagonally to zoom in both x and y
            </li>
            <li>
                <code>double-click</code> to reset x and y ranges
            </li>
            <li>
                <code>shift + drag-and-drop</code> to pan in x
            </li>
        </ul>
        <p>In addition, the plotting x and y ranges can be explicitly set in the Styling tab of the settings dialog.</p>
        <h3 id="exports">Exports</h3>
        <p>The histogram plot can be exported as a png file or a text file in tsv format via the buttons at the bottom-right corner (shown when hovering over the plot).</p>
        <h3 id="plot-cosmetics">Plot cosmetics</h3>
        <p>The appearance of the histogram plot is customizable via the Styling tab of the settings dialog (the cog icon). Supported options are:</p>
        <ul>
            <li>color of the plot</li>
            <li>plot styles including steps (default), lines, and dots</li>
            <li>line width for steps or lines</li>
            <li>point size for dots</li>
            <li>display y in logarithmic scale (default)</li>
            <li>plotting x and y ranges</li>
        </ul>
    </div>
);
