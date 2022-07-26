import {ImageComponent} from "../ImageComponent";
import widgetButtonStatistics from "static/help/widgetButton_statistics.png";
import widgetButtonStatistics_d from "static/help/widgetButton_statistics_d.png";

export const STATS_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={widgetButtonStatistics} dark={widgetButtonStatistics_d} width="90%" />
        </p>
        <p>Statistics widget allows you to view statistical quantities over a 2D region. When no region is created or selected, it displays statistical quantities of the full image in the image viewer.</p>
        <h3 id="images">Image</h3>
        <p>
            The <code>Image</code> dropdown menu defaults to &quot;Active&quot; image which means the current image in the image viewer if it is in single-panel mode. If it is in multi-panel mode, the active image is highlighted with a red
            box.
        </p>
        <h3 id="regions">Region</h3>
        <p>
            The <code>Region</code> dropdown menu defaults to &quot;Active&quot; region which means the region selected in the image viewer. You can select a region by clicking on one in the image viewer, or by clicking on a region entry in
            the region list widget. Statistics of the selected region will be updated accordingly.
        </p>
        <h3 id="polarization">Polarization</h3>
        <p>
            The <code>Polarization</code> dropdown menu defaults to &quot;Current&quot; which means the polarization component selected in the animator widget.
        </p>
        <h3 id="statistic">Statistic</h3>
        <p>CARTA provides the following statistical quantities:</p>
        <ul>
            <li>NumPixels: number of pixels in a region</li>
            <li>Sum: summation of pixel values in a region</li>
            <li>FluxDensity: total flux density in a region</li>
            <li>Mean: average of pixel values in a region</li>
            <li>StdDev: standard deviation of pixel values in a region</li>
            <li>Min: minimum pixel value in a region</li>
            <li>Max: maximum pixel value in a region</li>
            <li>Extrema: the maximum or minimum value in a region, depending on which absolute value is greater</li>
            <li>RMS: root mean square of pixel values in a region</li>
            <li>SumSq: summation of squared pixel values in a region</li>
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
