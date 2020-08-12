import * as React from "react";

export class StokesAnalysisSettingsScatterPlotStylingHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <h3>Scatter plot styling</h3>
                <p>The appearance of the scatter plot is customizable via the spectral profile settings dialogue (the cog icon). Supported options are:
                    <ul>
                        <li>Colormap</li>
                        <li>Symbol size</li>
                        <li>Symbol transparency</li>
                        <li>Q-to-U scale ratio as unity</li>
                    </ul>
                </p>
            </div>
        );
    }
}
