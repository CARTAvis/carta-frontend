import * as React from "react";
import {ImageComponent} from "./ImageComponent";
import headRenderconfigButton from "static/help/head_renderconfig_button.png";
import headRenderconfigButton_d from "static/help/head_renderconfig_button_d.png";

export class RenderConfigHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p><ImageComponent light={headRenderconfigButton} dark={headRenderconfigButton_d} width="90%"/></p>
                <p>Render configuration widget controls how a raster image is rendered in color space. The widget equips with a set of clip levels as buttons on the top. The clip boundaries are displayed in the &quot;Clip
                    Min&quot; and &quot;Clip Max&quot; fields. These fields can be manually edited and the clip level will switch to &quot;Custom&quot;. The clip boundaries are visualized as two vertical lines (also draggable) in red in the
                    histogram.</p>
                <p>As default, a per-channel histogram is shown, and optionally a per-cube histogram can be displayed via the &quot;Histogram&quot; dropdown. Different scaling functions and colormaps can be chosen via
                    the &quot;Scaling&quot; and &quot;Color map&quot; dropdowns, respectively. A color map might be inverted via the &quot;Invert color map&quot; toggle.</p>
                <p>The appearance of the histogram plot can be configured through the render configuration settings dialogue, including:</p>
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
                    <li><code>scrolling wheel</code> (up to zoom in and down to zoom out with respect to the cursor position)</li>
                    <li><code>click-and-drag</code> horizontally to zoom in x</li>
                    <li><code>click-and-drag</code> vertically to zoom in y</li>
                    <li><code>click-and-drag</code> diagonally to zoom in both x and y</li>
                    <li><code>double-click</code> to reset x and y ranges</li>
                    <li><code>shift + click-and-drag</code> to pan in x</li>
                </ul>
                <p>In addition, the x and y ranges can be explicitly set in the render configuration settings dialogue.</p>

            </div>
        );
    }
}
