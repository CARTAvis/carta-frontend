import widgetButtonStatistics from "static/help/widgetButton_statistics.png";
import widgetButtonStatistics_d from "static/help/widgetButton_statistics_d.png";

import {ImageComponent} from "../ImageComponent";

export const STATS_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={widgetButtonStatistics} dark={widgetButtonStatistics_d} width="90%" />
        </p>
        <p>
            The Statistics widget empowers you with the capability to observe statistical measurements across a designated 2D region. In cases where no specific region has been crafted or chosen, the widget presents statistical values
            concerning the entire image.
        </p>
        <h3 id="images">Image</h3>
        <p>
            The Image dropdown menu is primed to default to the "Active" image, signifying the image currently displayed within the image viewer. This selection pertains to the image being viewed in single-panel mode. However, if you're
            navigating within a multi-panel configuration, the active image is visually distinguished by a conspicuous red box, ensuring clear recognition.
        </p>
        <h3 id="regions">Region</h3>
        <p>
            Within the Region dropdown menu, the default selection is "Active" region, aligning with the currently highlighted region in the image viewer. Regions can be designated through direct interaction, either by clicking on them
            within the image viewer or by selecting a specific entry from the region list widget. Any statistical assessments performed will dynamically update based on the chosen region.
        </p>
        <h3 id="polarization">Polarization</h3>
        <p>
            In the context of the Polarization dropdown menu, the default choice is marked as "Current." This choice holds significance as it aligns precisely with the polarization component that mirrors the currently active selection
            within the animator widget. Notably, this encompasses not only direct polarization components but also extends to computed polarizations derived from Stokes IQUV parameters.
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
            The statistics table can be exported as a text file. The <code>Export</code> button shows up at the bottom-right corner of the widget when you hover over the table.
        </p>
        <br />
        <h4 id="tip">TIP</h4>
        <p>Multiple statistics widgets can be created to show statistics for different images with different polarization components (if applicable) and different regions.</p>
    </div>
);
