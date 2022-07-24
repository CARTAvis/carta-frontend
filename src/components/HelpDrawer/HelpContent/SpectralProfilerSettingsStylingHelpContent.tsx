export const SPECTRAL_PROFILER_SETTINGS_STYLING_HELP_CONTENT = (
    <div>
        <h3>Styling</h3>
        <p>
            The appearance of a spectral profile plot is customizable via the <code>Styling</code> tab. Supported options are:
        </p>
        <ul>
            <li>color of the plot</li>
            <li>plot styles including steps (default), lines, and dots</li>
            <li>line width for steps or lines</li>
            <li>point size for dots</li>
            <li>display mean and RMS</li>
            <li>x range</li>
        </ul>
        <h4>Profile mean and RMS</h4>
        <p>
            As an option in the spectral profiler settings dialog, mean and RMS values of the profile can be visualized as a green dashed line and a shaded area in the profile plot. Numerical values are displayed at the bottom-left corner.
            Note that CARTA includes all data in the current zoom level of the profile plot to perform the calculations. If zoom level changes, mean and RMS values will be updated too.
        </p>
    </div>
);
