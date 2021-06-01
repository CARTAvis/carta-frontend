import * as React from "react";
import {ImageComponent} from "./ImageComponent";
import headHistogramButton from "static/help/head_histogram_button.png";
import headHistogramButton_d from "static/help/head_histogram_button_d.png";

export class HistogramHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p><ImageComponent light={headHistogramButton} dark={headHistogramButton_d} width="90%"/></p>
                <p>Histogram widget displays a histogram plot derived from a 2D region. When no region is created or selected, it displays a histogram derived from the current full image in the image viewer.</p>
                <h3 id="images">Images</h3>
                <p>The image dropdown defaults to &quot;Active&quot; image which means the current image in the image viewer.</p>
                <h3 id="regions">Regions</h3>
                <p>The region dropdown defaults to &quot;Active&quot; region which means a selected region in the image viewer. You can select a region by clicking one in the image viewer, or by clicking a region entry on the region list
                    widget. Histogram plot of the selected region will be updated accordingly.</p>
                <h3 id="interactivity-zoom-and-pan">Interactivity: zoom and pan</h3>
                <p>The x and y ranges of the histogram plot can be modified by</p>
                <ul>
                    <li><code>scrolling wheel</code> (up to zoom in and down to zoom out with respect to the cursor position)</li>
                    <li><code>drag-and-drop</code> horizontally to zoom in x</li>
                    <li><code>drag-and-drop</code> vertically to zoom in y</li>
                    <li><code>drag-and-drop</code> diagonally to zoom in both x and y</li>
                    <li><code>double-click</code> to reset x and y ranges</li>
                    <li><code>shift + click-and-drag</code> to pan in x</li>
                </ul>
                <p>In addition, the x and y ranges can be explicitly set in the histogram settings dialog.</p>
                <h3 id="exports">Exports</h3>
                <p>The histogram plot can be exported as a png file or a text file in tsv format via the buttons at the bottom-right corner (shown when hovering over the plot).</p>
                <h3 id="plot-cosmetics">Plot cosmetics</h3>
                <p>The appearance of the histogram plot is customizable via the histogram settings dialog (the cog icon). Supported options are:</p>
                <ul>
                    <li>color of the plot</li>
                    <li>plot styles including steps (default), lines, and dots</li>
                    <li>line width for steps or lines</li>
                    <li>point size for dots</li>
                    <li>display y in logarithmic scale (default)</li>
                </ul>
                <br/>
                <h4 id="note">Note</h4>
                <p>In the current release, the number of histogram bins is automatically derived as the square root of the product of region bound box sizes in x and y. The development team will improve this in future releases.</p>
                <h4 id="tip">TIP</h4>
                <p>Multiple histogram widgets can be created to show histograms for different images with different regions.</p>
            </div>
        );
    }
}
