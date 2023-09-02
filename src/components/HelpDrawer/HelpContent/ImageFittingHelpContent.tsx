import dialogButtonImageFitting from "static/help/dialogButton_imageFitting.png";
import dialogButtonImageFitting_d from "static/help/dialogButton_imageFitting_d.png";

import {ImageComponent} from "../ImageComponent";

export const IMAGE_FITTING_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={dialogButtonImageFitting} dark={dialogButtonImageFitting_d} width="39%" />
        </p>
        <p>
            The Image Fitting Dialog provides the capability to fit multiple 2D Gaussian components to your image. The default <b>Data source</b> is the active image which is the current image in the Image Viewer if it is in single-panel
            mode or the image highlighted with a red box if it is in multi-panel mode. You may select other images as the input image with the <b>Data source</b> dropdown menu.
        </p>
        <p>
            By default, the image pixels used for the fitting process are coupled to the field of view of the Image Viewer. You can use zoom and pan actions to focus on the target image feature for the fit. Alternatively, you can select a
            region of interest or use a full image for the fitting process.
        </p>
        <p>
            You can use the <b>Components</b> spinbox to define the number of Gaussian components in the fit. For each component, you need to define a set of initial guesses to describe a 2D Gaussian including <b>Center</b>,{" "}
            <b>Amplitude</b>, <b>FWHM</b>, and <b>P.A. (deg)</b> (position angle). Optionally, a background value can be added to the fit as well. Free parameters may be fixed in the fitting process when it is necessary.
        </p>
        <p>
            The major FWHM axis is aligned to the North-South direction of the sky, while the minor FWHM axis is aligned to the East-West direction of the sky. The origin (0 degree) of the P.A. points to the North and the P.A. increases
            toward the East.
        </p>
        <p>
            Once the initial solutions of a set of Gaussian components are set, you can click the <b>Fit</b> button to trigger the image fitting process. The fitting result is displayed in the <b>Fitting Result</b> tab. In the{" "}
            <b>Full Log</b> tab, more information about the fitting results is provided, including the best-fit solution in the image coordinate. Via the <b>Export</b> button in the bottom-right corner of the <b>Fitting Result</b> tab, you
            can export the fitting result or log as a text file.
        </p>
        <p>Three different solvers are provided in the Image Fitting Dialog. During the fitting process, you may cancel it if necessary.</p>
        <p>
            By default, model image and residual image will be generated and appended once the fitting process succeeds. If these are not required, you can use the toggles to disable the feature. Optionally, via the <code>Region</code>{" "}
            button in the bottom-right corner of the <code>Fitting Result</code> tab, you can generate a set of ellipse regions as a representation of the FWHM of the best-fit Gaussians.
        </p>
    </div>
);
