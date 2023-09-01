import widgetButtonStokes from "static/help/widgetButton_stokes.png";
import widgetButtonStokes_d from "static/help/widgetButton_stokes_d.png";

import {ImageComponent} from "../ImageComponent";

export const STOKES_ANALYSIS_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={widgetButtonStokes} dark={widgetButtonStokes_d} width="90%" />
        </p>
        <p>
            The Stokes Analysis Widget is designed for efficient visualization of a cube with multiple channels and multiple Stokes parameters (at least Stokes Q and U). If you have individual Stokes images as separate files, you can use
            the File Browser Dialog to select them in the file list (multiple selection), and then click the <b>Load as hypercube</b> button to form a virtual Stokes cube.
        </p>
        <p>The widget includes the following plots:</p>
        <ul>
            <li>Region spectral profiles for Stokes Q and Stokes U, portrayed either in absolute or fractional values (in the presence of Stokes I).</li>
            <li>Polarized intensity spectral profile, in absolute or fractional values (if Stokes I is available).</li>
            <li>Linear polarization angle spectral profile</li>
            <li>A scatter plot correlating Stokes Q and Stokes U.</li>
        </ul>
        <p>These plots interact with each other to provide a cohesive analytical experience. When you zoom into a profile, the data within the visible range will be highlighted dynamically in the scatter plot, and vice versa.</p>
        <h3 id="images">Image dropdown menu</h3>
        <p>
            The <b>Image</b> dropdown menu defaults to the "Active" image. This is the image which is currently displayed in the Image Viewer if it is in single-panel mode, or the image which is highlighted with a red box if the viewer is
            in multi-panel mode.
        </p>
        <h3 id="regions">Region dropdown menu</h3>
        <p>
            The <b>Region</b> dropdown menu defaults to the "Active" region, which is the region currently highlighted in the Image Viewer. You can select a region by clicking on it in the Image Viewer or by selecting an entry in the Region
            List Widget. The Stokes and polarization profile plots will be updated automatically. If no region is selected, the "Active" region defaults to the cursor position.
        </p>
        <h3 id="spectral-conventions-and-reference-frame">Spectral conventions and reference frame</h3>
        <p>
            In the Stokes Analysis Settings Dialog, the <b>Conversion</b> tab allows you to configure the spectral convention. The available options are:
        </p>
        <ul>
            <li>Radio velocity (km/s, m/s)</li>
            <li>Optical velocity (km/s, m/s)</li>
            <li>Frequency (GHz, MHz, kHz, Hz)</li>
            <li>Wavelength (m, mm, um, Angstrom)</li>
            <li>Air wavelength (m, mm, um, Angstrom)</li>
            <li>Channel</li>
        </ul>
        <p>The same tab allows you to set the spectral reference frame to one of the following options:</p>
        <ul>
            <li>LSRK: the rest-frame of the kinematical local standard of rest</li>
            <li>LSRD: the rest-frame of the dynamical local standard of rest</li>
            <li>BARY: barycentric, the rest-frame of the solar-system barycenter</li>
            <li>TOPO: topocentric, the observer's rest-frame on Earth</li>
        </ul>
        <p>Note that some of these options depend on the completeness of image headers. Some conversions may not be available.</p>
        <h3 id="data-smoothing">Data smoothing</h3>
        <p>
            The displayed profiles and the scatter plot can be smoothed via the <b>Smoothing</b> tab of the Stokes Analysis Settings Dialog (the cog button). A shortcut button to the <b>Smoothing</b> tab can be found at the top-right corner
            of the widget.
        </p>
        <h3 id="interactivity-zoom-pan-changing-channel">Interactivity: zoom, pan, changing channel</h3>
        <p>The x and y ranges of the Stokes profile plot can be modified by</p>
        <ul>
            <li>
                <code>scrolling wheel</code> (up to zoom in and down to zoom out with respect to the cursor position)
            </li>
            <li>
                <code>drag-and-drop</code> horizontally to zoom in x
            </li>
            <li>
                <code>drag-and-drop</code> vertically to zoom in y
            </li>
            <li>
                <code>drag-and-drop</code> diagonally to zoom in both x and y
            </li>
            <li>
                <code>double-click</code> to reset x and y ranges
            </li>
            <li>
                <code>shift + drag-and-drop</code> to pan in x
            </li>
        </ul>
        <p>
            You may click on the Stokes profile plot to switch to a channel (as indicated by a red vertical line) and view the image in the Image Viewer. The red line is draggable and acts equivalently like the <b>Channel</b> slider in the
            Animator Widget.
        </p>
        <h3 id="exports">Profile plot and scatter plot export</h3>
        <p>
            To export these visualizations, you can save them as either a PNG image file or a text file in TSV format. This process is achieved through dedicated buttons at the bottom-right corner of each plot. These <b>Export</b> buttons
            appear when you hover over the plot.
        </p>
        <h3 id="plot-cosmetics">Plot cosmetics</h3>
        <p>
            The appearance of the Stokes profile plot is customizable via the <b>Line Plot Styling</b> tab of the Stokes Analysis Settings Dialog (the cog button). The supported options are:
        </p>
        <ul>
            <li>colors of Stokes Q and Stokes U profiles</li>
            <li>plot styles including steps (default), lines, and dots</li>
            <li>line width for steps and lines</li>
            <li>point size for dots</li>
        </ul>
        <p>
            In addition, the appearance of the scatter plot can be customized with the <b>Scatter Plot Styling</b> tab too, including:
        </p>
        <ul>
            <li>Colormap (invertible)</li>
            <li>Symbol size</li>
            <li>Symbol transparency</li>
            <li>Q-to-U axis scale ratio as unity</li>
        </ul>
    </div>
);
