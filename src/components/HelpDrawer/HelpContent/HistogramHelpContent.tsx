import widgetButtonHistogram from "static/help/widgetButton_histogram.png";
import widgetButtonHistogram_d from "static/help/widgetButton_histogram_d.png";

import {ImageComponent} from "../ImageComponent";

export const HISTOGRAM_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={widgetButtonHistogram} dark={widgetButtonHistogram_d} width="90%" />
        </p>
        <p>
            The Histogram Widget displays a histogram plot based on the selections in the <b>Image</b>, <b>Region</b>, and <b>Polarization</b> dropdown menus. When there is no region or no active region, the entire image is used to compute
            the histogram.
        </p>
        <p>
            In the <b>Configuration</b> tab of the Histogram Settings Dialog, you have fine-grained control over the histogram generation parameters, including bounds and number of bins.
        </p>
        <h3 id="image">Image</h3>
        <p>
            The <b>Image</b> dropdown menu defaults to "Active" image which means the current image in the Image Viewer if it is in the single-panel mode. If it is in the multi-panel mode, the active image is highlighted with a red box.
        </p>
        <h3 id="region">Region</h3>
        <p>
            The <b>Region</b> dropdown menu defaults to "Active" region which means a selected region in the Image Viewer. You can select a region by clicking on one in the Image Viewer, or by clicking on a region entry in the Region List
            Widget. The histogram plot of the selected region will be updated accordingly. When there is no region or no region is selected (active), the entire image is used to compute the histogram.
        </p>
        <h3 id="polarization">Polarization</h3>
        <p>
            The <b>Polarization</b> dropdown menu defaults to "Current" which synchronizes with the selection in the Animator Widget. Besides the Stokes components as defined in the image header, computed components such as linear
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
        <p>
            In addition, the plotting x and y ranges can be explicitly set in the <b>Styling</b> tab of the Histogram Settings Dialog.
        </p>
        <h3 id="exports">Exports</h3>
        <p>The histogram plot can be exported as a PNG file or a text file in TSV format via the buttons at the bottom-right corner (shown when hovering over the plot).</p>
        <h3 id="plot-cosmetics">Plot cosmetics</h3>
        <p>
            The appearance of the histogram plot is customizable via the <b>Styling</b> tab of the Histogram Settings Dialog (the cog icon). Supported options are:
        </p>
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
