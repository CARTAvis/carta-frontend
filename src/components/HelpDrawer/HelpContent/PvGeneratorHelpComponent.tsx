import {ImageComponent} from "../ImageComponent";
import widgetButtonPVGenerator from "static/help/widgetButton_pvGenerator.png";
import widgetButtonPVGenerator_d from "static/help/widgetButton_pvGenerator_d.png";

export const PV_GENERATOR_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={widgetButtonPVGenerator} dark={widgetButtonPVGenerator_d} width="90%" />
        </p>
        <p>
            The PV generator widget allows you to configure how a PV (position-velocity) image is generated. When there are multiple images loaded, you can use the <code>Image</code> dropdown menu to select an image as the data source. If
            there are multiple line regions, you can use the <code>Region</code> dropdown menu to select a line region as the PV cut. The averaging width along the PV cut can be defined with the <code>Average width</code> spinbox. If the
            image is considered as <em>flat</em>, the width is defined in image pixels. However, if the image is considered as <em>wide</em> with noticeable projection distortion, the width in this case is in unit angular size derived from
            the header of the input image.
        </p>
        <p>
            When a PV image is being computed, a progress bar will appear to let you know the progress of the PV image generation. You may abort the generation process by clicking the <code>Cancel</code> button. Once the generation process
            is finished, the resulting PV image will be appended automatically. The PV image is stored in memory. If you would like to keep it for further analysis, you can save it to disk (<strong>File</strong> -&gt;{" "}
            <strong>Save image</strong>).
        </p>
        <p>
            When a line region (aka the PV cut) is re-sampled for the PV image generation, the projection distortion of the input image is considered. If the image is considered as <em>flat</em>, the PV cut is sampled with a regular step in
            pixels. However, if the image is considered as <em>wide</em> with noticeable projection distortion, the PV cut is sampled with a fixed angular increment. The resulting offset axis will still be a linear axis.
        </p>
    </div>
);
