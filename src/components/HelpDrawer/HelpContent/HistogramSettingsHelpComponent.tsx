import * as React from "react";

export class HistogramSettingsHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p>Histogram settings dialog allows you to customize the appearance of the histogram plot, and set x and y ranges of the plot explicitly.</p>
                <p>Supported options are:</p>
                <ul>
                    <li>color of the plot</li>
                    <li>plot styles including steps (default), lines, and dots</li>
                    <li>line width for steps or lines</li>
                    <li>point size for dots</li>
                    <li>display y in logarithmic scale (default)</li>
                </ul>
            </div>
        );
    }
}
