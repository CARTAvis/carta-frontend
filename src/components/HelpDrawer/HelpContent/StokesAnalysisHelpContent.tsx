import {ImageComponent} from "../ImageComponent";
import widgetButtonStokes from "static/help/widgetButton_stokes.png";
import widgetButtonStokes_d from "static/help/widgetButton_stokes_d.png";

export const STOKES_ANALYSIS_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={widgetButtonStokes} dark={widgetButtonStokes_d} width="90%" />
        </p>
        <p>
            The Stokes analysis widget is made for efficient visualization of a cube with <em>multiple channels and multiple Stokes parameters (at least Stokes Q and U)</em>. If you have Stokes images as individual files, please use the
            file browser to select them (multiple selection) in the file list first and click the <code>Load as hypercube</code> button to form a Stokes hypercube.
        </p>
        <p>The widget includes plots, such as:</p>
        <ul>
            <li>Region spectral profiles for Stokes Q and Stokes U, as absolute or fractional values (if Stokes I is present)</li>
            <li>Polarized intensity spectral profile, as absolute or fractional values (if Stokes I is present)</li>
            <li>Linearly polarized angle spectral profile</li>
            <li>Stokes Q vs Stokes U scatter plot</li>
        </ul>
        <p>All these plots are inter-linked so that when zooming profiles, data in the visible range will be highlighted in the scatter plot, and vice versa.</p>
        <h3 id="images">Image dropdown menu</h3>
        <p>
            The <code>Image</code> dropdown defaults to &quot;Active&quot; image which means the current image in the image viewer if it is in single-panel mode. If it is in multi-panel mode, the active image is highlighted with a red box.
        </p>
        <h3 id="regions">Region dropdown menu</h3>
        <p>
            The <code>Region</code> dropdown defaults to &quot;Active&quot; region which means the region selected in the image viewer. You can select a region by clicking on one in the image viewer, or by clicking on a region entry in the region
            list widget. Stokes and polarization profile plots of the selected region will be updated accordingly. If no region is selected, &quot;Active&quot; region defaults to cursor.
        </p>
        <h3 id="spectral-conventions-and-reference-frame">Spectral conventions and reference frame</h3>
        <p>
            With the <code>Conversion</code> tab of the Stokes analysis settings dialog, you can change the spectral convention, including:
        </p>
        <ul>
            <li>Radio velocity (km/s, m/s)</li>
            <li>Optical velocity (km/s, m/s)</li>
            <li>Frequency (GHz, MHz, kHz, Hz)</li>
            <li>Wavelength (m, mm, um, Angstrom)</li>
            <li>Air wavelength (m, mm, um, Angstrom)</li>
            <li>Channel</li>
        </ul>
        <p>and spectral reference frame, including:</p>
        <ul>
            <li>LSRK: the rest-frame of the kinematical local standard of rest</li>
            <li>LSRD: the rest-frame of the dynamical local standard of rest</li>
            <li>BARY: barycentric, the rest-frame of the solar-system barycenter</li>
            <li>TOPO: topocentric, the observer's rest-frame on Earth</li>
        </ul>
        <p>Note that depending on the integrity of image headers, some conversions may not be possible.</p>
        <h3 id="data-smoothing">Data smoothing</h3>
        <p>
            The displayed profiles and the scatter plot can be smoothed via the <code>Smoothing</code> tab of the Stokes analysis settings dialog (the <code>cog</code> button). A shortcut button to the <code>Smoothing</code> tab can be
            found at the top-right corner of the widget.
        </p>
        <h3 id="responsive-and-progressive-profile-update">Responsive and progressive profile update</h3>
        <p>
            When region Stokes profiles are requested, depending on the performance of the server, you may see that profiles are updated piece by piece at regular intervals. This feature provides a visual progress update for better user
            experience. In addition, if you move a region while profiles are updating, the old calculations will be terminated immediately and calculations of the new region Stokes profiles will start. You will see partial profiles in
            seconds.
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
            You may click on the Stokes profile plot to switch to a channel (as indicated by a red vertical line) and view the image in the image viewer. The red line is draggable and acts equivalently like the channel slider in the
            animator widget.
        </p>
        <h3 id="exports">Profile plot and scatter plot export</h3>
        <p>The Stokes profile plots and the Stokes QU scatter plot can be exported as a png file or a text file in tsv format via the buttons at the bottom-right corner (shown when you hover over the plot).</p>
        <h3 id="plot-cosmetics">Plot cosmetics</h3>
        <p>
            The appearance of the Stokes profile plot is customizable via the <code>Line Plot Styling</code> tab of the Stokes analysis settings dialog (the <code>cog</code> button). Supported options are:
        </p>
        <ul>
            <li>colors of Stokes Q and Stokes U profiles</li>
            <li>plot styles including steps (default), lines, and dots</li>
            <li>line width for steps or lines</li>
            <li>point size for dots</li>
        </ul>
        <p>
            In addition, the appearance of the scatter plot can be customized with the <code>Scatter Plot Styling</code> tab too, including:
        </p>
        <ul>
            <li>Color map</li>
            <li>Symbol size</li>
            <li>Symbol transparency</li>
            <li>Q-to-U axis scale ratio as unity</li>
        </ul>
    </div>
);
