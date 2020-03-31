import * as React from "react";
import {AppStore} from "stores";
import {ImageComponent} from "./ImageComponent";

export class RenderConfigSettingsHelpComponent extends React.Component<{ appStore: AppStore }> {
    public render() {
        return (
            <div>
                <p>The appearance of the histogram plot in the render configuration widget can be customized through this settings dialogue, including:</p>
                <ul>
                    <li>color of the plot</li>
                    <li>plot styles including steps (default), lines, and dots</li>
                    <li>line width for steps or lines</li>
                    <li>point size for dots</li>
                    <li>display y in logarithmic scale (default)</li>
                    <li>display mean and RMS</li>
                    <li>display clip labels</li>
                </ul>

            </div>
        );
    }
}
