import * as React from "react";
import {ImageComponent} from "./ImageComponent";
import headContourButton from "static/help/head_contour_button.png";
import headContourButton_d from "static/help/head_contour_button_d.png";

export class ContourHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p><ImageComponent light={headContourButton} dark={headContourButton_d} width="90%"/></p>
                <p>Contour configuration dialogue allows users to generate a contour layer on top of a raster image in the image viewer. Steps to create a contour layer with the &quot;Levels&quot; tab are:</p>
                <ol>
                    <li>
                        <p>Select an image from the &quot;Data source&quot; dropdown. A per-channel histogram of the current channel and current Stokes as indicated in the animator will be displayed with visualization of mean (in dashed
                            line) and mean +/- one standard deviation (in shaded area). Optionally, users can request per-cube histogram if necessary.</p>
                    </li>
                    <li>
                        <p>Define a set of contour levels to be calculated and rendered. There are various ways to define levels:</p>
                        <ul>
                            <li><code>Click</code> on the histogram plot to create a level. &nbsp;<code>Right-Click</code> on a line to remove a level. Numerical values of levels are displayed in the &quot;Levels&quot; field.</li>
                            <li>Use the level generator. There are four preset generators. The generator will create a set of levels based on the control parameters by clicking the &quot;Generate&quot; button.</li>
                            <li>Manually input levels in the &quot;Levels&quot; field. Note that this field can be modified at any time, for example, after using the level generator.</li>
                        </ul>
                    </li>
                    <li>
                        <p>When a set of levels is defined, clicking the &quot;Apply&quot; button will trigger the contour calculations and render in the image viewer.</p>
                    </li>
                </ol>
                <p>To remove a contour layer, click the &quot;Clear&quot; button.</p>
                <p>Users may use the lock button next to the data source dropdown to disable or enable synchronization of data source with the image slider in the animator.</p>
                <h3 id="contour-smoothness">Contour smoothness</h3>
                <p>By default, image is Gaussian-smoothed with a kernel size of four pixels before calculating contour vertices. This can be customized in the &quot;Configuration&quot; tab. Smoothing mode includes:</p>
                <ul>
                    <li>No smoothing</li>
                    <li>Block (faster, not ideal for compact objects)</li>
                    <li>Gaussian (default, slower, better appearance)</li>
                </ul>
                <h3 id="contour-cosmetics">Contour styling</h3>
                <p>The styling of contours can be customized with the &quot;Styling&quot; tab. Supported options are:</p>
                <ul>
                    <li>Line thickness</li>
                    <li>Representation of dashed line</li>
                    <li>Color as constant color or color-mapped</li>
                    <li>Bias</li>
                    <li>Contrast</li>
                </ul>
                <p>Note that changes in styling will be applied immediately if the contour levels set does not change.</p>
                <h3 id="customizing-the-contour-configuration-dialogue">Customizing the contour configuration dialogue</h3>
                <p>The defaults of many options in the contour configuration dialogue are customizable via the &quot;Contour configuration&quot; tab in the preference dialogue.</p>
                <p>Performance related options are included in the &quot;Performance&quot; tab of the preference dialogue. <em>Note that we do not recommend to modify the factory defaults. Change with cautions.</em></p>
            </div>
        );
    }
}
