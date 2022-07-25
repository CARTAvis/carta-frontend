import {ImageComponent} from "../ImageComponent";
import dialogButtonImageFitting from "static/help/dialogButton_imageFitting.png";
import dialogButtonImageFitting_d from "static/help/dialogButton_imageFitting_d.png";

export const IMAGE_FITTING_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={dialogButtonImageFitting} dark={dialogButtonImageFitting_d} width="39%" />
        </p>
        <p>
            The image fitting dialog allows you to fit multiple 2D Gaussian components to your image. The default <code>Data Source</code> is the active image which is the current image in the image viewer if it is single-panel mode or the
            image highlighted with a red box if it is multi-panel mode. You may select other images as the input image with the <code>Data Source</code> dropdown menu. In the current implementation, the input image data is coupled to the
            field of view of the image viewer. You can use zoom and pan actions to define a subimage for the fit. In a future release, you will be able to select a region as the subimage for the fitting process.
        </p>
        <p>
            You can use the <code>Components</code> spinbox to define the number of Gaussian components in the fit. For each component, you need to define a set of initial guesses to describe a 2D Gaussian including <code>Center</code>,{" "}
            <code>Amplitude</code>, <code>FWHM</code>, and <code>P.A. (deg)</code> (position angle). In the current implementation, center and FWHM are defined in pixels. In a future release, these two parameters can also be defined in
            angular units.
        </p>
        <p>
            Once the initial solutions of a set of Gaussian components are set, you can click the <code>Fit</code> button to trigger the image fitting process. The fitting result is displayed in the <code>Fitting Result</code> tab. In the{" "}
            <code>Full Log</code> tab, more information of the fitting results is provided, including the best-fit solution in the image coordinate.
        </p>
    </div>
);
