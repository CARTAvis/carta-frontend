import * as React from "react";
import {AppStore} from "stores";
import {ImageComponent} from "./ImageComponent";
import * as underConstruction from "static/help/under_construction.png";

export class SpatialProfilerSettingsHelpComponent extends React.Component<{ appStore: AppStore }> {
    public render() {
        return (
            <div>
                <p>The spatial profiler settings dialogue allows users to adjust the appearance of the profile plot, and set x and y ranges of the plot explicitly. In addition, users can select which cut (horizontal or vertical) at cursor
                    to use to generate a spatial profile. Users may also enable visualization of mean and RMS values of the current profile in the plot.</p>
                <p>Supported options for plot appearance are:</p>
                <ul>
                    <li>color of the plot</li>
                    <li>plot styles including steps (default), lines, and dots</li>
                    <li>line width for steps or lines</li>
                    <li>point size for dots</li>
                    <li>display alternative horizontal axis in world coordinate</li>
                </ul>
            </div>
        );
    }
}
