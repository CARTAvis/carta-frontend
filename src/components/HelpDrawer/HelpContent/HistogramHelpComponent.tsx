import * as React from "react";
import * as underConstruction from "static/help/under_construction.png";

export class HistogramHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p>Histogram widget displays a histogram plot dervied from a region. When no region is created or selected, it displays a histogram derived from the current full image in the image viewer.</p>
                <h3 id="regions">Regions</h3>
                    <p>The region dropdown defaults to &quot;Active&quot; region which means a selected region in the image viewer. Users can select a region by clicking one on the image viewer, or by clicking a region entry on the region list widget. Histogram plot of the selected region will be updated accordingly.</p>
                <h3 id="interactivity-zoom-and-pan">Interactivity: zoom and pan</h3>
                    <p>The x and y ranges of the histogram plot can be modified by</p>
                        <ul>
                            <li><code>scrolling wheel</code> (up to zoom in and down to zoom out with respect to the cursor position)</li>
                            <li><code>click-and-drag</code> horizontally to zoom in x</li>
                            <li><code>click-and-drag</code> vertically to zoom in y</li>
                            <li><code>click-and-drag</code> diagonally to zoom in both x and y</li>
                            <li><code>double-click</code> to reset x and y ranges</li>
                            <li><code>shift + click-and-drag</code> to pan in x</li>
                        </ul>
                    <p>In addition, the x and y ranges can be explicitly set in the historgam settings dialogue.</p>
                <h3 id="exports">Exports</h3>
                    <p>The histogram plot can be exported as a png file or a text file in tsv format via the buttons at the bottm-right corner (shown when hovering over the plot).</p>
                <h3 id="plot-cosmetics">Plot cosmetics</h3>
                    <p>The appearance of the histogram plot is customizable via the histogram settings dialogue (the cog icon). Supported options are:</p>
                        <ul>
                            <li>color of the plot</li>
                            <li>plot styles including steps (default), lines, and dots</li>
                            <li>line width for steps or lines</li>
                            <li>point size for dots</li>
                            <li>display y in logarithmic scale (default)</li>
                        </ul>
                
                <br />

                <blockquote>
                    <p><strong>NOTE</strong></p>
                    <p>In the current release, the number of histogram bins is automatically dervied as the square root of the product of region bound box sizes in x and y. The developmemt team will improve this in future releases.</p>
                </blockquote>
                <blockquote>
                    <p><strong>TIP</strong></p>
                    <p>Multiple histogram widgets can be created to show histograms for different regions.</p>
                </blockquote>
            </div>
        );
    }
}
