import widgetButtonStatistics from "static/help/widgetButton_statistics.png";
import widgetButtonStatistics_d from "static/help/widgetButton_statistics_d.png";

import {ImageComponent} from "../ImageComponent";

export const STATS_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={widgetButtonStatistics} dark={widgetButtonStatistics_d} width="90%" />
        </p>
        <p>
            The Statistics Widget allows you to view statistics for a selected 2D region. If no region has been created or selected, the widget displays statistics for the <em>entire</em> image.
        </p>
        <h3 id="images">Image</h3>
        <p>
            The <b>Image</b> dropdown menu defaults to "Active", which means the currently selected image. This is the image which is visible in the Image Viewer (if it is in the single-panel mode). If the viewer is in the multi-panel mode,
            the active image is highlighted with a red box.
        </p>
        <h3 id="regions">Region</h3>
        <p>
            The <b>Region</b> dropdown menu defaults to "Active", which means the region currently selected in the Image Viewer. You can select a region by clicking on it in the Image Viewer or by selecting an entry in the Region List
            Widget. The displayed statistics will be updated automatically.
        </p>
        <h3 id="polarization">Polarization</h3>
        <p>
            The <b>Polarization</b> dropdown menu defaults to "Current", which is the polarization currently selected in the <b>Polarization</b> slider in the Animator Widget. Selectable polarizations include not only the components defined
            in the image header, but also computed polarizations derived from the Stokes IQUV parameters.
        </p>
        <h3 id="statistic">Statistic</h3>
        <p>CARTA provides the following statistical quantities:</p>
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
            The statistics table can be exported as a text file. The <b>Export</b> button appears in the bottom-right corner of the widget when you hover over the table.
        </p>
        <br />
        <h4 id="tip">TIP</h4>
        <p>Multiple statistics widgets can be created to show statistics for different images with different polarization components (if applicable) and different regions.</p>
    </div>
);
