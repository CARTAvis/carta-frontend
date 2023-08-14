import widgetButtonPVGenerator from "static/help/widgetButton_pvGenerator.png";
import widgetButtonPVGenerator_d from "static/help/widgetButton_pvGenerator_d.png";

import {ImageComponent} from "../ImageComponent";

export const PV_GENERATOR_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={widgetButtonPVGenerator} dark={widgetButtonPVGenerator_d} width="90%" />
        </p>
        <p>
            There are two modes in the PV generator widget:
            <ul>
                <li>Production mode: generate full resolution PV image based on the selected image, the PV cut, and the custom spectral range.</li>
                <li>Preview mode: generate a downsampled cube in memory based on the Preview settings and provide an interactive and a live view of a preview PV image when the selected PV cut is being dragged.</li>
            </ul>
        </p>
        <h3 id="productionMode">Production mode</h3>
        <p>
            The PV generator widget provides you the interface to configure how a PV (position-velocity) image is generated. When there are multiple images loaded, you can use the <code>Image</code> dropdown menu to select an image as the
            data source.
        </p>
        <p>
            Line region should be created first and will serve as the PV cut for the PV image generation. If there are multiple line regions, you can use the <code>PV cut</code> dropdown menu to select a line region as the PV cut. The
            averaging width along the PV cut can be defined with the <code>Average width</code> spinbox. If the image is considered as <em>flat</em>, the width is defined in image pixels. However, if the image is considered as <em>wide</em>{" "}
            with noticeable projection distortion, the width in this case is in unit angular size derived from the CDELT header of the input image.
        </p>
        <p>A spectral range can be conveniently defined via the Range text fields along with the System dropdown menu. This would result a PV image focusing on the spectral feature in interests.</p>
        <p>
            The orientation of the PV image can be customized via the Axes order dropdown menu. If there is already a generated PV image in the image viewer, you can decide if a newly generated PV image should be a replacement or not via
            the Keep previous PV image(s) toggle.
        </p>
        <p>
            Once the above-mentioned parameters are set, by clicking the Generate button, the PV generation process will start. When a PV image is being computed, a progress bar will appear to let you know the progress of the PV image
            generation. You may abort the generation process by clicking the <code>Cancel</code> button. Once the generation process is finished, the resulting PV image will be appended automatically. The PV image is stored in memory. If
            you would like to keep it for further analysis, you can save it to disk (<strong>File</strong> -&gt; <strong>Save image</strong>).
        </p>
        <p>
            When a line region (aka the PV cut) is re-sampled for the PV image generation, the projection distortion of the input image is considered. If the image is considered as <em>flat</em>, the PV cut is sampled with a regular step in
            pixels. However, if the image is considered as <em>wide</em> with noticeable projection distortion, the PV cut is sampled with a fixed angular increment. The resulting offset axis will still be a linear axis.
        </p>
        <h3 id="previewMode">Preview mode</h3>
        <p>
            In addition to the production mode, CARTA supports a preview mode of PV image on-the-fly when the selected PV cut is being dragged. You will need to use the Preview region dropdown and the Preview rebin input fields to configure
            how a downsampled cube should be derived from the full resolution cube. The preview cube size will be calculated and displayed accordingly. The downsampled cube has a default upper limit of 1 GB in size. The upper limit may be
            reconfigured in the file <code>~/.carta/config/preferences.json</code> with the key-value pairs <code>"pvPreviewCubeSizeLimit": 1.0</code> and <code>"pvPreviewCubeSizeLimitUnit": "GB"</code>. Please be caution when you change
            the setup if your carta_backend system has limited memory resource.
        </p>
        <p>
            When a downsampled cube is generated, a PV preview widget will show up and display a PV image derived along the selected PV cut. You can drag the PV cut along and have a live update of the preview PV images. This feature would
            help you to explore your image cube from a different angle efficiently. Once you are happy with the configuration of the PV cut, you can use the Generate button to get a full resolution PV image to proceed detailed analysis.
        </p>
    </div>
);
