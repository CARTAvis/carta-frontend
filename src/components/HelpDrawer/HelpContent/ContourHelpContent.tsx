import dialogButtonContourConfig from "static/help/dialogButton_contourConfig.png";
import dialogButtonContourConfig_d from "static/help/dialogButton_contourConfig_d.png";

import {ImageComponent} from "../ImageComponent";

export const CONTOUR_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={dialogButtonContourConfig} dark={dialogButtonContourConfig_d} width="39%" />
        </p>
        <p>
            Contour configuration dialog allows you to generate a contour layer on top of a raster image in the image viewer. Steps to create a contour layer with the <code>Levels</code> tab are:
        </p>
        <ol>
            <li>
                <p>
                    Select an image from the <code>Data Source</code> dropdown menu. A per-channel histogram of the current channel and current Stokes as indicated in the animator will be displayed with visualization of mean (in dashed
                    line) and mean +/- one standard deviation (in shaded area). Optionally, you can request a per-cube histogram if necessary.
                </p>
            </li>
            <li>
                <p>Define a set of contour levels to be calculated and rendered. There are various ways to define levels:</p>
                <ul>
                    <li>
                        <code>Click</code> on the histogram plot to create a level. &nbsp;<code>Right-Click</code> on a line to remove a level. Numerical values of levels are displayed in the <code>Levels</code> field.
                    </li>
                    <li>
                        Use the level generator. There are four preset generators. The generator will create a set of levels based on the control parameters by clicking the <code>Generate</code> button.
                    </li>
                    <li>
                        Manually input levels in the <code>Levels</code> field. Note that this field can be modified at any time, for example, after using the level generator.
                    </li>
                </ul>
            </li>
            <li>
                <p>
                    When a set of levels is defined, clicking the <code>Apply</code> button will trigger contour calculations and rendering in the image viewer. Contour data is streamed progressively.
                </p>
            </li>
        </ol>
        <p>
            To remove a contour layer, click the <code>Clear</code> button.
        </p>
        <p>
            You may use the <code>lock</code> button next to the <code>Data Source</code> dropdown menu to disable or enable synchronization of data source with the active image as specified with the image slider in the animator.
        </p>
        <h3 id="contour-smoothness">Contour smoothness</h3>
        <p>
            By default, the image is Gaussian-smoothed with a kernel size of four by four pixels before contour vertices are calculated. This can be customized in the <code>Configuration</code> tab. Supported smoothing modes are:
        </p>
        <ul>
            <li>No smoothing (not ideal for low signal-to-noise features</li>
            <li>Block (not ideal for compact objects)</li>
            <li>Gaussian (default, better appearance)</li>
        </ul>
        <h3 id="contour-cosmetics">Contour styling</h3>
        <p>
            The styling of contours can be customized with the <code>Styling</code> tab. Supported options are:
        </p>
        <ul>
            <li>Line thickness</li>
            <li>Representation of dashed line</li>
            <li>Color as constant color or color-mapped</li>
            <li>Bias</li>
            <li>Contrast</li>
        </ul>
        <p>Note that changes in styling will be applied immediately if the contour level set does not change.</p>
        <h3 id="customizing-the-contour-configuration-dialog">Customizing the contour configuration dialog</h3>
        <p>
            The defaults of many options in the contour configuration dialog are customizable via the <code>Contour configuration</code> tab in the preferences dialog.
        </p>
        <p>
            Performance-related options are included in the <code>Performance</code> tab of the preferences dialog. <em>Note that we do not recommend modifying the factory defaults. Change with caution.</em>
        </p>
    </div>
);
