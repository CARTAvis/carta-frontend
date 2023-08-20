import dialogButtonContourConfig from "static/help/dialogButton_contourConfig.png";
import dialogButtonContourConfig_d from "static/help/dialogButton_contourConfig_d.png";

import {ImageComponent} from "../ImageComponent";

export const CONTOUR_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={dialogButtonContourConfig} dark={dialogButtonContourConfig_d} width="39%" />
        </p>
        <p>
            With the Contour Configuration Dialog, a contour layer can be configured and rendered on top of a raster image. If raster images are spatially matched, the same contour layer will be rendered on top of the matched raster images
            as well. Steps to create a contour layer with the <b>Levels</b> tab are:
        </p>
        <ol>
            <li>
                <p>
                    Select data source: Begin by selecting an image from the <b>Data source</b> dropdown menu. A per-channel histogram, aligned with the current channel and polarization settings indicated by the Animator Widget, takes
                    center stage. This histogram shows the mean value (as a dashed line) and the range of one standard deviation (as a shaded area). Optionally, you can opt for a per-cube histogram if necessary.
                </p>
            </li>
            <li>
                <p>Define contour levels: Multiple routes to this definition are available:</p>
                <ul>
                    <li>
                        Interactive: Click on the histogram plot to generate a contour level. Right-click on a line to eliminate a level. The <b>Levels</b> input field displays numerical values of your defined levels.
                    </li>
                    <li>
                        Level generator: Leverage the built-in level generator (<b>Generator</b> dropdown menu), with four preset options. By clicking the <b>Generate</b> button, these generators create a set of levels based on control
                        parameters you define (<b>Parameters</b> input fields and spinboxes).
                    </li>
                    <li>
                        Manual input: Directly input your desired levels into the <b>Levels</b> input field. Notably, this field remains adaptable, allowing adjustments even after utilizing the level generator.
                    </li>
                </ul>
            </li>
            <li>
                <p>
                    Apply and visualize: Upon defining your set of levels, a click on the <b>Apply</b> button springs contour calculations into action. This triggers the rendering of contours within the Image Viewer, with contour data
                    streaming progressively.
                </p>
            </li>
        </ol>
        <p>
            To remove the contour layer as defined and rendered with the dialog, click the <b>Clear</b>Clear button.
        </p>
        <p>
            Furthermore, a locking mechanism (<b>Lock</b> button) adjacent to the <b>Data source</b> dropdown menu offers the option to toggle synchronization. This empowers you to disable or enable data source synchronization with the
            active image, aligning with the state of the <b>Image</b> slider in the Animator Widget.
        </p>
        <h3 id="contour-smoothness">Contour smoothness</h3>
        <p>
            The generation of contours is underpinned by Gaussian smoothing, with a default kernel size of four by four pixels, conducted prior to contour vertex computation. Customizing this process to your preferences is made possible
            within the <b>Configuration</b> tab. Three smoothing modes are at your choices, including:
        </p>
        <ul>
            <li>No smoothing (not advised for low signal-to-noise features)</li>
            <li>Block (suboptimal for compact objects)</li>
            <li>Gaussian (default and offers ideal visual quality)</li>
        </ul>
        <h3 id="contour-cosmetics">Contour styling</h3>
        <p>
            The styling of contours can be customized with the <b>Styling</b> tab. Supported options are:
        </p>
        <ul>
            <li>Line thickness</li>
            <li>Representation of dashed line</li>
            <li>Color as a constant color or as variable</li>
            <li>Bias</li>
            <li>Contrast</li>
        </ul>
        <p>Notably, alterations to contour styling take effect immediately, provided the contour level set remains unchanged.</p>
        <h3 id="customizing-the-contour-configuration-dialog">Customizing the contour configuration dialog</h3>
        <p>
            The defaults of many options in the Contour Configuration Dialog are customizable via the <b>Contour configuration</b> tab in the Preferences Dialog.
        </p>
        <p>
            Performance-related options are included in the <b>Performance</b> tab of the Preferences Dialog. <em>Note that we do not recommend modifying the factory defaults. Change with caution.</em>
        </p>
    </div>
);
