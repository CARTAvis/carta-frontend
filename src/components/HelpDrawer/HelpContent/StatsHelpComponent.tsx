import * as React from "react";
import {ImageComponent} from "./ImageComponent";
import headStatisticsButton from "static/help/head_statistics_button.png";
import headStatisticsButton_d from "static/help/head_statistics_button_d.png";

export class StatsHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p><ImageComponent light={headStatisticsButton} dark={headStatisticsButton_d} width="90%"/></p>
                <p>Statistics widget allows you to view statistical quantities over a 2D region. When no region is created or selected, it displays statistical quantities of the full image in the image viewer.</p>
                <h3 id="images">Images</h3>
                <p>The image dropdown defaults to &quot;Active&quot; image which means the current image in the image viewer.</p>
                <h3 id="regions">Regions</h3>
                <p>The region dropdown defaults to &quot;Active&quot; region which means a selected region in the image viewer. You can select a region by clicking one on the image viewer, or by clicking a region entry on the region list
                    widget. Statistics of the selected region will be updated accordingly.</p>
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
                <p>The statistics table can be exported as a text file. The &quot;Export&quot; button shows up at the bottom-right corner of the widget when you hover over the table.</p>
                <br/>
                <h4 id="tip">TIP</h4>
                <p>Multiple statistics widgets can be created to show statistics for different images and different regions.</p>
            </div>
        );
    }
}
