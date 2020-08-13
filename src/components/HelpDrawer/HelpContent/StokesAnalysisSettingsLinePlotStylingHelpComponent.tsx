import * as React from "react";

export class StokesAnalysisSettingsLinePlotStylingHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <h3>Line Plot Styling</h3>
                <p>The appearance of the spectral profile plot is customizable via the spectral profile settings dialogue (the cog icon). Supported options are:
                    <ul>
                        <li>color of the plot</li>
                        <li>plot styles including steps (default), lines, and dots</li>
                        <li>line width for steps or lines</li>
                        <li>point size for dots</li>
                    </ul>
                </p>
            </div>
        );
    }
}
