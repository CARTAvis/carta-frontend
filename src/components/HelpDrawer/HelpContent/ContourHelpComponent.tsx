import * as React from "react";
import * as underConstruction from "static/help/under_construction.png";

export class ContourHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p>Contour configuration dialogue allows users to geneate a contour layer on top of a raster image in the image
        viewer. Steps to create a contour layer with the &quot;Levels&quot; tab are:</p>
                <ol>
                    <li>
                        <p>Select an image from the &quot;Data source&quot; dropdown. A per-channel histogram of the current channel
                            and current Stokes as indicated in the animator will be displayed with visualization of mean (in dashed
                            line) and mean +/- one standard deviation (in shaded area). Optionally, users can request per-cube
                histogram if necessary.</p>
                    </li>
                    <li>
                        <p>Define a set of contour levels to be calculated and rendered. There are various ways to define levels:
            </p>
                        <ul>
                            <li><code>Click</code> on the histogram plot to create a level. <code>Right-Click</code> on a line to
                    remove a level. Numerical values of levels are displayed in the &quot;Levels&quot; field.</li>
                            <li>Use the level generator. There are four preset generators. The genetator will create a set of levels
                    based on the control parameters by pressing the &quot;Generate&quot; button.</li>
                            <li>Manually input levels in the &quot;Level&quot; field. Note that this field can be modified at any
                    time, for example, after using the level generator.</li>
                        </ul>
                    </li>
                    <li>
                        <p>When a set of levels is defined, pressing the &quot;Apply&quot; button will trigger the contour
                calculations and render in the image viewer.</p>
                    </li>
                </ol>
                <p>To remove a contour layer, press the &quot;Clear&quot; button.</p>
                <p>Users may use the lock button next to the data source dropdown to disable or enable sychronization of data source
        with the frame slider in the animator.</p>
                <h3 id="contour-smoothness">Contour smoothness</h3>
                <p>By default, image is block-smoothed with a kernal size of four pixels before calculating contour vertices. This
        can be customized in the &quot;Confoguration&quot; tab. Smoothing mode incldues:</p>
                <ul>
                    <li>No smoothing</li>
                    <li>Block (default, faster, but not ideal for compact objects)</li>
                    <li>Gaussian (slower, but better appearance)</li>
                </ul>
                <h3 id="contour-cosmetics">Contour cosmetics</h3>
                <p>The cosmectics of contours can be customized with the &quot;Styling&quot; tab. Supported options are:</p>
                <ul>
                    <li>Line thickness</li>
                    <li>Representation of dashed line</li>
                    <li>Color as constant color or color-mapped</li>
                    <li>Bias</li>
                    <li>Contrast</li>
                </ul>
                <p>Note that changes in cosmetics will be applied immediately if the contour levels set does not change.</p>
                <h3 id="customizing-the-contour-configuration-dialogue">Customizing the contour configuration dialogue</h3>
                <p>The defaults of many options in the contour configuration dialogue are customizable via the preference dialogue.
        In the &quot;Contour configuration&quot; tab, those include:</p>
                <ul>
                    <li>Level generator type</li>
                    <li>Contour smoothing mode</li>
                    <li>Smoothing factor</li>
                    <li>Number of contour levels</li>
                    <li>Contour line thickness</li>
                    <li>Contour color mode</li>
                    <li>Contour colormap</li>
                    <li>Contour constant color</li>
                </ul>
                <p>Performance related options are included in the &quot;Performance&quot; tab of the preference dialogue,
        including:</p>
                <ul>
                    <li>Contour rounding factor</li>
                    <li>Contour compression level</li>
                    <li>Contour chunk size</li>
                    <li>Contour control map resolution</li>
                </ul>
                <p><em>Note that we do not recommand to modify the factory defaults. Change with cautions.</em></p>
            </div>
        );
    }
}
