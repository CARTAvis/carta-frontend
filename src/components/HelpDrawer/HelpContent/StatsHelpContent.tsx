import widgetButtonStatistics from "static/help/widgetButton_statistics.png";
import widgetButtonStatistics_d from "static/help/widgetButton_statistics_d.png";

import {ImageComponent} from "../ImageComponent";

export const STATS_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={widgetButtonStatistics} dark={widgetButtonStatistics_d} width="90%" />
        </p>
        <p>
            The Statistics Widget empowers you with the capability to observe statistical measurements in a designated 2D region. In cases where no specific region has been crafted or chosen, the widget presents statistical values
            concerning the <em>entire</em> image.
        </p>
        <h3 id="images">Image</h3>
        <p>
            The <b>Image</b> dropdown menu is primed to default to the "Active" image, signifying the image currently displayed within the Image Viewer. This selection pertains to the image being viewed in single-panel mode. However, if you
            are using the multi-panel configuration, the active image is visually distinguished by a red box, ensuring clear recognition.
        </p>
        <h3 id="regions">Region</h3>
        <p>
            Within the <b>Region</b> dropdown menu, the default selection is "Active" region, aligning with the currently highlighted region in the Image Viewer. Regions can be designated through direct interaction, either by clicking on
            them within the Image Viewer or by selecting a specific entry from the Region List Widget. Any statistical assessments performed will dynamically update based on the chosen region.
        </p>
        <h3 id="polarization">Polarization</h3>
        <p>
            In the context of the <b>Polarization</b> dropdown menu, the default choice is marked as "Current." This choice is synchronized with the selection of the <b>Polarization</b> slider in the Animator Widget. Notably, this
            encompasses not only the native polarization components as defined in the image header but also extends to computed polarizations derived from Stokes IQUV parameters.
        </p>
        <h3 id="statistic">Statistic</h3>
        <p>CARTA offers an array of essential statistical measurements, encompassing the following quantities:</p>
        <ul>
            <li>NumPixels: the pixel count within a specified region.</li>
            <li>Sum: the cumulative sum of pixel values within a region.</li>
            <li>FluxDensity: the total flux density encapsulated within a region.</li>
            <li>Mean: the average value of pixel data within a region.</li>
            <li>StdDev: the standard deviation of pixel values within a region.</li>
            <li>Min: the minimum pixel value observed within a region.</li>
            <li>Max: the maximum pixel value observed within a region.</li>
            <li>Extrema: the higher absolute value between the maximum and minimum within a region.</li>
            <li>RMS: the root mean square of pixel values within a region.</li>
            <li>SumSq: the sum of squared pixel values within a region.</li>
        </ul>
        <h3>Text export</h3>
        <p>
            The statistics table can be exported as a text file. The <b>Export</b> button shows up at the bottom-right corner of the widget when you hover over the table.
        </p>
        <br />
        <h4 id="tip">TIP</h4>
        <p>Multiple statistics widgets can be created to show statistics for different images with different polarization components (if applicable) and different regions.</p>
    </div>
);
