import * as React from "react";
import {AppStore} from "stores";
import {ImageComponent} from "./ImageComponent";
import * as underConstruction from "static/help/under_construction.png";

export class HistogramSettingsHelpComponent extends React.Component<{ appStore: AppStore }> {
    public render() {
        return (
            <div>
                <p>Histogram settings dialogue allows users to customize the appearance of the histogram plot, and set x and y ranges of the plot explicitly.</p>
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
