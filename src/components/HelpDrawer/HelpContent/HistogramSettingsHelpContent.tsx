export const HISTOGRAM_SETTINGS_HELP_CONTENT = (
    <div>
        <p>The Histogram Settings Dialog allows you to customize how a histogram is computed and the appearance of the histogram plot.</p>
        <h3>Configuration</h3>
        <p>
            By default, the bounds and number of histogram bins are computed automatically. If you need to set these parameters manually, disable the <b>Auto pixel bounds</b> toggle and <b>Auto bins</b> toggle first, and then define the
            values via the text input fields and the slider.
        </p>
        <h3>Styling</h3>
        <p>Supported options are:</p>
        <ul>
            <li>color of the plot</li>
            <li>plot styles including steps (default), lines, and dots</li>
            <li>line width for steps or lines</li>
            <li>point size for dots</li>
            <li>display y in logarithmic scale (default)</li>
            <li>plotting x and y ranges</li>
        </ul>
    </div>
);
