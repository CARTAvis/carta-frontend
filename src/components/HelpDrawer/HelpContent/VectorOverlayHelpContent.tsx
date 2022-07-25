import {ImageComponent} from "../ImageComponent";
import dialogButtonVectorOverlay from "static/help/dialogButton_vectorOverlay.png";
import dialogButtonVectorOverlay_d from "static/help/dialogButton_vectorOverlay_d.png";

export const VECTOR_OVERLAY_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={dialogButtonVectorOverlay} dark={dialogButtonVectorOverlay_d} width="39%" />
        </p>
        <h3>Configuration</h3>
        <p>
            The vector overlay configuration dialog is primarily designed for visualization of linear polarization images. There are different ways to configure how a vector element is derived from the <code>Data Source</code> via the{" "}
            <code>Angular Source</code> and <code>Intensity Source</code> dropdown menus.
            <ul>
                <li>
                    For visualization of linear polarization from a Stokes IQU or QU cube with variable vector length and angle: set the <code>Anguar Source</code> to &quot;Computed PA&quot; and set the <code>Intensity Source</code> to
                    &quot;Computed PI&quot;.
                </li>
                <li>
                    For visualization of linear polarization from a Stokes IQU or QU cube with fixed vector length and variable angle: set the <code>Anguar Source</code> to &quot;Computed PA&quot; and set the <code>Intensity Source</code>{" "}
                    to &quot;None&quot;.
                </li>
                <li>
                    For visualization of linear polarization from a pre-computed position angle image in degree: set the <code>Anguar Source</code> to &quot;Current image&quot; and set the <code>Intensity Source</code> to &quot;None&quot;.
                </li>
                <li>
                    For visualization of a scalar field by interpreting pixel value as the strength or intensity: set the <code>Anguar Source</code> to &quot;None&quot; and set the <code>Intensity Source</code> to &quot;Current image&quot;.
                    With this mode, filled square marker is rendered instead of line segment.
                </li>
            </ul>
        </p>
        <p>
            Usually block smoothing is applied to the image to enhance signal-to-noise ratio before computing vector elements. You can enable the <code>Pixel Averaging</code> toggle (default enabled) and set the{" "}
            <code>Averaging Width (px)</code> (default 4 by 4) to apply pixel averaging.
        </p>
        <p>
            When the <code>Intensity Source</code> is &quot;Computed PI&quot;, you can select &quot;Absolute&quot; or &quot;Fractional&quot; polarization intensity with the <code>Polarization Intensity</code> radio buttons. A threshold for
            Stokes I may be applied to mask out noisy parts of the image with the <code>Threshold</code> field when the <code>Threshold Enabled</code> toggle is switched on. If Stokes I is not avaiable (i.e., the input image has Stokes Q
            and U only), the threshold is applied to Stokes Q and Stokes U to construct a mask. Optionally, you may apply <code>Debiasing</code> to the polarization intensity and angle calculations by enabling the <code>Debiasing</code>{" "}
            toggle and set errors for Stokes Q and U in the <code>Stokes Q Error</code> and the <code>Stokes U Error</code> fields, respestively.
        </p>
        <p>
            Once the control parameters of how a vector overlay is computed are set, you can click the <code>Apply</code> button to trigger the computation and rendering process. The vector overlay data will be streamed progressively
            similar to the raster rendering with image tiles. Click the <code>Clear</code> button to remove the vector overlay.
        </p>
        <p>On spatially matched images, vector elements are reprojected precisely based on the projection schemes. This behaves the same as the contour overlay and catalog image overlay.</p>
        <h3>Styling</h3>
        <p>
            With the <code>Styling</code> tab, you can configure how vector elements are rendered, including:
            <ul>
                <li>line thickness</li>
                <li>intensity to vector length mapping</li>
                <li>additional rotation offset to vector angle</li>
                <li>color modes of vector elements</li>
            </ul>
        </p>
    </div>
);
