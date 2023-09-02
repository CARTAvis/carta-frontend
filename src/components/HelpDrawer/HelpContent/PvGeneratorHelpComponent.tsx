import widgetButtonPVGenerator from "static/help/widgetButton_pvGenerator.png";
import widgetButtonPVGenerator_d from "static/help/widgetButton_pvGenerator_d.png";

import {ImageComponent} from "../ImageComponent";

export const PV_GENERATOR_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={widgetButtonPVGenerator} dark={widgetButtonPVGenerator_d} width="90%" />
        </p>
        <p>
            There are two modes in the PV Generator Widget:
            <ul>
                <li>Production mode: generate a full resolution PV image based on the selected image, the PV cut, and the custom spectral range.</li>
                <li>Preview mode: generate a downsampled cube in memory based on the preview settings and provide an interactive and live view of a preview PV image when the selected PV cut is being dragged.</li>
            </ul>
        </p>
        <h3 id="productionMode">Production mode</h3>
        <p>
            The PV Generator Widget provides you the interface to configure how a PV (position-velocity) image is generated. When there are multiple images loaded, you can use the <b>Image</b> dropdown menu to select an image as the data
            source.
        </p>
        <p>
            A line region should be created first and will serve as the PV cut for the PV image generation. If there are multiple line regions, you can use the <b>PV cut</b> dropdown menu to select a line region as the PV cut. The averaging
            width along the PV cut can be defined with the <b>Average width</b> spinbox. If the image is considered as <em>flat</em>, the width is defined in image pixels. However, if the image is considered as <em>wide</em> with noticeable
            projection distortion, the width in this case is in unit angular size derived from the <code>CDELT</code> header of the input image.
        </p>
        <p>
            A spectral range can be conveniently defined via the <b>Range</b> text fields along with the <b>System</b> dropdown menu. This would result in a PV image focusing on the spectral feature in interest.
        </p>
        <p>
            The orientation of the PV image can be customized via the <b>Axes order</b> dropdown menu. If there is already a generated PV image in the Image Viewer, you can decide if the newly generated PV image should be a replacement or
            not via the <b>Keep previous PV image(s)</b> toggle.
        </p>
        <p>
            Once the above-mentioned parameters are set, by clicking the <b>Generate</b> button, the PV generation process will start. While a PV image is being computed, a progress bar will appear to let you know the progress of the PV
            image generation. You may abort the generation process by clicking the <b>Cancel</b> button. Once the generation process is finished, the resulting PV image will be appended automatically. The PV image is stored in memory. If
            you would like to keep it for further analysis, you can save it to disk (<b>File -&gt; Save Image</b>).
        </p>
        <p>
            When a line region (aka the PV cut) is re-sampled for the PV image generation, the projection distortion of the input image is considered. If the image is considered as <em>flat</em>, the PV cut is sampled with a regular step in
            pixels. However, if the image is considered as <em>wide</em> with noticeable projection distortion, the PV cut is sampled with a fixed angular increment. The resulting offset axis will still be a linear axis.
        </p>
        <h3 id="previewMode">Preview mode</h3>
        <p>
            In addition to the production mode, CARTA supports a preview mode of PV image on-the-fly when the selected PV cut is being dragged. You will need to use the <b>Preview region</b> dropdown and the <b>Preview rebin</b> input
            fields to configure how the downsampled cube should be derived from the full resolution cube. The <b>Preview cube size</b> will be calculated and displayed accordingly. The downsampled cube has a default upper limit of 1 GB in
            size.
        </p>
        <p>
            When a downsampled cube is generated, a PV Preview Widget will show up and display a PV image derived along the selected PV cut. You can drag the PV cut along and have a live update of the preview PV images. This feature would
            help you to explore your image cube from a different angle efficiently. Once you are happy with the configuration of the PV cut, you can use the <b>Generate</b> button to get a full resolution PV image to proceed further
            detailed analysis.
        </p>
    </div>
);
