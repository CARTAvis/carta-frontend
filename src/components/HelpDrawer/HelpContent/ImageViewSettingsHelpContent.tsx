export const IMAGE_VIEW_SETTINGS_HELP_CONTENT = (
    <div>
        <p>The image view settings dialog allows you to customize the appearance of the image viewer.</p>

        <h3 id="global">Global</h3>
        <p>This section allows you to</p>
        <ul>
            <li>configure single-panel mode and multi-panel mode</li>
            <li>set a global color theme for the grid overlay</li>
            <li>configure grid line rendering accuracy</li>
            <li>put coordinate labels inside or outside the image</li>
            <li>select a coordinate reference frame to generate the grid overlay</li>
        </ul>

        <h3 id="title">Title</h3>
        <p>A custom title can be added in the image view. Its font type, font size, and color are configurable.</p>

        <h3 id="ticks">Ticks</h3>
        <p>This section allows you to change the ticks properties, including location, density, color, line width, and length of major and minor ticks.</p>

        <h3 id="grid">Grids</h3>
        <p>The appearance of the coordinate grid lines is customizable, including visibility, color, and line width. Optionally, the pixel grid can be visualized at high zoom levels.</p>

        <h3 id="border">Border</h3>
        <p>This section allows you to change the style of the axis border, including visibility, color, and width.</p>

        <h3 id="axes">Axes</h3>
        <p>This section allows you to adjust the appearance of an interior axis overlay, including visibility, color, and line width.</p>

        <h3 id="numbers">Numbers</h3>
        <p>This section allows you to customize the appearance of tick values, including:</p>
        <ul>
            <li>visibility</li>
            <li>font type and size</li>
            <li>color</li>
            <li>format as sexagesimal or decimal degree</li>
            <li>coordinate precision</li>
        </ul>

        <h3 id="labels">Labels</h3>
        <p>This section allows you to modify the styles of the x and y labels, such as font type, font size, and color. A custom label can be defined.</p>

        <h3>Colorbar</h3>
        <p>The appearance of the colorbar is highly configurable. This includes:</p>
        <ul>
            <li>visibility</li>
            <li>interactivity</li>
            <li>position</li>
            <li>bar width</li>
            <li>offset</li>
            <li>ticks density</li>
            <li>label style</li>
            <li>ticks value style</li>
            <li>ticks style</li>
            <li>border style</li>
        </ul>

        <h3 id="beam">Beam</h3>
        <p>This section allows you to change the appearance of a beam overlay (visibility, color, type, and line width) and adjust its position in the image viewer.</p>

        <h3>Conversion</h3>
        <p>
            This allows conversions of the spectral axis of a position-velocity image. For example, if the image header supports required information, the axis labels can be displayed as offset v.s. velocity, offset v.s. frequency, or
            offset v.s. wavelength, etc..
        </p>
    </div>
);
