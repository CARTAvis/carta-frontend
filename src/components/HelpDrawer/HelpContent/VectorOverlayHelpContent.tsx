import dialogButtonVectorOverlay from "static/help/dialogButton_vectorOverlay.png";
import dialogButtonVectorOverlay_d from "static/help/dialogButton_vectorOverlay_d.png";

import {ImageComponent} from "../ImageComponent";

export const VECTOR_OVERLAY_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={dialogButtonVectorOverlay} dark={dialogButtonVectorOverlay_d} width="39%" />
        </p>
        <h3>Configuration</h3>
        <p>
            The Vector overlay configuration dialog is primarily designed for visualization of linear polarization images. There are different ways to configure how a vector element is derived from the <b>Data Source</b> via the{" "}
            <b>Angular source</b> and <b>Intensity source</b> dropdown menus.
            <ul>
                <li>
                    For visualization of linear polarization from a Stokes IQU or QU cube with variable vector length and angle: set the <b>Angular source</b> to &quot;Computed PA&quot; and set the <b>Intensity source</b> to &quot;Computed
                    PI&quot;.
                </li>
                <li>
                    For visualization of linear polarization from a Stokes IQU or QU cube with fixed vector length and variable angle: set the <b>Angular source</b> to &quot;Computed PA&quot; and set the <b>Intensity source</b> to
                    &quot;None&quot;.
                </li>
                <li>
                    For visualization of linear polarization from a pre-computed position angle image in degrees: set the <b>Angular source</b> to &quot;Current image&quot; and set the <b>Intensity source</b> to &quot;None&quot;.
                </li>
                <li>
                    For visualization of a scalar field by interpreting pixel value as the strength or intensity: set the <b>Angular source</b> to &quot;None&quot; and set the <b>Intensity source</b> to &quot;Current image&quot;. With this
                    mode, filled square markers with variable sizes are rendered instead of line segments.
                </li>
            </ul>
        </p>
        <p>
            Usually block smoothing is applied to the image to enhance signal-to-noise ratio before computing vector elements. You can enable the <b>Pixel averaging</b> toggle (enabled by default) and set the <b>Averaging width (px)</b>{" "}
            (default 4 by 4) to apply pixel averaging.
        </p>
        <p>
            When the <b>Intensity Source</b> is &quot;Computed PI&quot;, you can select &quot;Absolute&quot; or &quot;Fractional&quot; polarization intensity with the <b>Polarization intensity</b> radio buttons. A threshold for Stokes I may
            be applied to mask out noisy parts of the image with the <b>Threshold</b> field when the <b>Threshold enabled</b> toggle is switched on. If Stokes I is not available (i.e., the input image has Stokes Q and U only), the threshold
            is applied to Stokes Q and Stokes U to construct a mask. Optionally, you may apply <b>Debiasing</b> to the polarization intensity and angle calculations by enabling the <b>Debiasing</b> toggle and set errors for Stokes Q and U
            in the <b>Stokes Q error</b> and the <b>Stokes U error</b> fields, respectively.
        </p>
        <p>
            Once the control parameters of how a vector overlay is computed are set, you can click the <b>Apply</b> button to trigger the computation and rendering process. The vector overlay data will be streamed progressively similarly to
            the raster rendering with image tiles. Click the <b>Clear</b> button to remove the vector overlay.
        </p>
        <p>On spatially matched images, vector elements are reprojected precisely based on the projection schemes. This behaves the same as the contour overlay and catalog image overlay.</p>
        <h3>Styling</h3>
        <p>
            With the <b>Styling</b> tab, you can configure how vector elements are rendered, including:
            <ul>
                <li>line thickness</li>
                <li>intensity to vector length mapping</li>
                <li>additional rotation offset to vector angle</li>
                <li>color modes of vector elements</li>
            </ul>
        </p>
    </div>
);
