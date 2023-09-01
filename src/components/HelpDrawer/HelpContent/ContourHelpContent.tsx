import dialogButtonContourConfig from "static/help/dialogButton_contourConfig.png";
import dialogButtonContourConfig_d from "static/help/dialogButton_contourConfig_d.png";

import {ImageComponent} from "../ImageComponent";

export const CONTOUR_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={dialogButtonContourConfig} dark={dialogButtonContourConfig_d} width="39%" />
        </p>
        <p>
            The Contour Configuration Dialog allows a contour layer to be configured and rendered on top of a raster image. The same contour layer will be rendered over all spatially matched raster images. A contour layer can be created in
            the <b>Levels</b> tab with the following steps:
        </p>
        <ol>
            <li>
                <p>
                    Select data source: begin by selecting an image from the <b>Data source</b> dropdown menu. A per-channel histogram, aligned with the current channel and polarization settings indicated by the Animator Widget, will be
                    displayed. This histogram shows the mean value (as a dashed line) and the range of one standard deviation (as a shaded area). Optionally, you can switch to a per-cube histogram.
                </p>
            </li>
            <li>
                <p>Define contour levels: multiple configuration methods are available.</p>
                <ul>
                    <li>
                        Interactive: click on the histogram plot to generate a contour level. Right-click on a line to eliminate a level. The <b>Levels</b> input field displays the numerical values of your configured levels.
                    </li>
                    <li>
                        Level generator: use a built-in level generator (<b>Generator</b> dropdown menu) selected from one of four preset options. Click the <b>Generate</b> button to create a set of levels based on the control parameters
                        provided (<b>Parameters</b> input fields and spinboxes).
                    </li>
                    <li>
                        Manual input: directly input your desired levels into the <b>Levels</b> input field. Note that this field can be modified at any time, and can be used to adjust levels generated with the other methods.
                    </li>
                </ul>
            </li>
            <li>
                <p>
                    Apply and visualize: after defining your set of levels, click on the <b>Apply</b> button to start the contour calculations and render the contours in the Image Viewer. Contour data will be streamed progressively.
                </p>
            </li>
        </ol>
        <p>
            To remove the configured contour layer, click the <b>Clear</b> button.
        </p>
        <p>
            A locking mechanism (<b>Lock</b> button) adjacent to the <b>Data source</b> dropdown menu allows you to disable or enable synchronization of the data source with the active image (as indicated by the <b>Image</b> slider in the
            Animator Widget).
        </p>
        <h3 id="contour-smoothness">Contour smoothness</h3>
        <p>
            When the contours are generated, a smoothing step is applied prior to vertex computation. This process can be customized in the <b>Configuration</b> tab. Three smoothing modes are available (the default is Gaussian smoothing
            with a kernel size of four by four pixels):
        </p>
        <ul>
            <li>No smoothing (not advised for low signal-to-noise features)</li>
            <li>Block (suboptimal for compact objects)</li>
            <li>Gaussian (the default; offers optimal visual quality)</li>
        </ul>
        <h3 id="contour-cosmetics">Contour styling</h3>
        <p>
            The styling of contours can be customized with the <b>Styling</b> tab. Supported options are:
        </p>
        <ul>
            <li>Line thickness</li>
            <li>Representation of dashed line</li>
            <li>Color as a constant color or as a colormap</li>
            <li>Bias</li>
            <li>Contrast</li>
        </ul>
        <p>Note that alterations to contour styling take effect immediately, provided the contour level set remains unchanged.</p>
        <h3 id="customizing-the-contour-configuration-dialog">Customizing the contour configuration dialog</h3>
        <p>
            The defaults of many options in the Contour Configuration Dialog are customizable via the <b>Contour configuration</b> tab in the Preferences Dialog.
        </p>
        <p>
            Performance-related options are included in the <b>Performance</b> tab of the Preferences Dialog. <em>Note that we do not recommend modifying the factory defaults. Change with caution.</em>
        </p>
    </div>
);
