import widgetButtonStokes from "static/help/widgetButton_stokes.png";
import widgetButtonStokes_d from "static/help/widgetButton_stokes_d.png";

import {ImageComponent} from "../ImageComponent";

export const STOKES_ANALYSIS_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={widgetButtonStokes} dark={widgetButtonStokes_d} width="90%" />
        </p>
        <p>
            The Stokes Analysis widget emerges as a versatile tool tailored for streamlined visualization of multi-channel cubes encompassing diverse Stokes parameters, including at least Stokes Q and U. In scenarios where you possess
            individual Stokes images as separate files, the process is effortless: simply engage the file browser, select the desired files (multiple selections are supported) from the list, and subsequently employ the "Load as Hypercube"
            button to assemble a cohesive Stokes hypercube.
        </p>
        <p>The widget includes plots as:</p>
        <ul>
            <li>Region Spectral Profiles for Stokes Q and Stokes U, portrayed either in absolute or fractional values (in the presence of Stokes I).</li>
            <li>Polarized Intensity Spectral Profile, again represented as absolute or fractional values (in the presence of Stokes I).</li>
            <li>Linearly polarization angle spectral profile</li>
            <li>A Scatter Plot correlating Stokes Q and Stokes U.</li>
        </ul>
        <p>This suite of plots is interlinked. When zooming into profiles, data within the visible range is reciprocally highlighted in the scatter plot, fostering a dynamic and cohesive analytical experience.</p>
        <h3 id="images">Image dropdown menu</h3>
        <p>
            The Image dropdown menu comes pre-configured with the "Active" image as its default option. This denotes the current image displayed within the image viewer, particularly when the viewer is set to single-panel mode. Should the
            viewer be operating in multi-panel mode, the active image is readily distinguishable, being adorned with a prominent red highlight.
        </p>
        <h3 id="regions">Region dropdown menu</h3>
        <p>
            Within the Region dropdown menu, the default selection is aptly titled "Active" region. This indicates the region that is actively chosen within the image viewer. You have the flexibility to pick a region by directly clicking on
            one within the image viewer or by selecting a region entry from the region list widget. Subsequently, the plots depicting Stokes and polarization profiles for the selected region will be promptly updated to reflect the changes.
            In instances where no specific region is chosen, the term "Active" region gracefully defaults to your cursor's position, ensuring uninterrupted functionality.
        </p>
        <h3 id="spectral-conventions-and-reference-frame">Spectral conventions and reference frame</h3>
        <p>Within the Stokes Analysis settings, a pivotal component is the Conversion tab. This tab equips you with the capability to tailor the spectral convention to your preferences, offering an array of choices including:</p>
        <ul>
            <li>Radio velocity (km/s, m/s)</li>
            <li>Optical velocity (km/s, m/s)</li>
            <li>Frequency (GHz, MHz, kHz, Hz)</li>
            <li>Wavelength (m, mm, um, Angstrom)</li>
            <li>Air wavelength (m, mm, um, Angstrom)</li>
            <li>Channel</li>
        </ul>
        <p>Moreover, the same tab empowers you to set the spectral reference frame, presenting a range of options:</p>
        <ul>
            <li>LSRK: the rest-frame of the kinematical local standard of rest</li>
            <li>LSRD: the rest-frame of the dynamical local standard of rest</li>
            <li>BARY: barycentric, the rest-frame of the solar-system barycenter</li>
            <li>TOPO: topocentric, the observer's rest-frame on Earth</li>
        </ul>
        <p>Note that the availability of these options may vary based on the completeness of image headers, with some conversions potentially being limited by the available data.</p>
        <h3 id="data-smoothing">Data smoothing</h3>
        <p>
            The displayed profiles and the scatter plot can be smoothed via the <code>Smoothing</code> tab of the Stokes analysis settings dialog (the <code>cog</code> button). A shortcut button to the <code>Smoothing</code> tab can be
            found at the top-right corner of the widget.
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
        <p>
            To export these visualizations, you can save them as either a PNG image file or a text file in TSV (Tab-Separated Values) format. This process is achieved through dedicated buttons positioned at the bottom-right corner of each
            plot. These export buttons appear when you hover over the plot.
        </p>
        <h3 id="plot-cosmetics">Plot cosmetics</h3>
        <p>
            The appearance of the Stokes profile plot is customizable via the <code>Line Plot Styling</code> tab of the Stokes analysis settings dialog (the <code>cog</code> button). The supported options are:
        </p>
        <ul>
            <li>colors of Stokes Q and Stokes U profiles</li>
            <li>plot styles including steps (default), lines, and dots</li>
            <li>line width for steps and lines</li>
            <li>point size for dots</li>
        </ul>
        <p>
            In addition, the appearance of the scatter plot can be customized with the <code>Scatter Plot Styling</code> tab too, including:
        </p>
        <ul>
            <li>Colormap (invertable)</li>
            <li>Symbol size</li>
            <li>Symbol transparency</li>
            <li>Q-to-U axis scale ratio as unity</li>
        </ul>
    </div>
);
