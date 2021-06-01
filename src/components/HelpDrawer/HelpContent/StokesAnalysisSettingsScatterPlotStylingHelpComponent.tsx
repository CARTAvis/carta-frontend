import * as React from "react";

export class StokesAnalysisSettingsScatterPlotStylingHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <h3>Scatter Plot Styling</h3>
                <p>The appearance of the scatter plot is customizable via the <code>Scatter Plot Styling</code> tab. Supported options are:</p>
                <ul>
                    <li>Colormap</li>
                    <li>Symbol size</li>
                    <li>Symbol transparency</li>
                    <li>Q-to-U scale ratio as unity</li>
                </ul>
            </div>
        );
    }
}
