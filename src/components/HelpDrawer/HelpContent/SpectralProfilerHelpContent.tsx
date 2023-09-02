import widgetButtonSpectralProfiler from "static/help/widgetButton_spectralProfiler.png";
import widgetButtonSpectralProfiler_d from "static/help/widgetButton_spectralProfiler_d.png";

import {ImageComponent} from "../ImageComponent";

export const SPECTRAL_PROFILER_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={widgetButtonSpectralProfiler} dark={widgetButtonSpectralProfiler_d} width="90%" />
        </p>
        <p>
            The Spectral Profiler Widget provides two different modes of viewing spectral profiles, depending on the states of the <b>Image</b> checkbox, the <b>Region</b> checkbox, the <b>Statistic</b> checkbox, and the <b>Polarization</b>{" "}
            checkbox.{" "}
        </p>
        <h3>Single-profile mode</h3>
        <p>
            When no checkboxes are selected, the Spectral Profiler Widget displays only one spectrum at a time. You can view a region spectral profile (via the <b>Region</b> dropdown menu) of an image cube (via the <b>Image</b> dropdown
            menu) with a specific statistic (via the <b>Statistic</b> dropdown menu; the default is mean). If the polarization axis exists, you may view a specific polarization component via the <b>Polarization</b> dropdown menu. You may
            have multiple widgets to view spectra side by side.
        </p>
        <h3>Multi-profile mode</h3>
        <p>
            When one of the checkboxes (<b>Image</b>/<b>Region</b>/<b>Statistic</b>/<b>Polarization</b>) is selected, the Spectral Profiler Widget can display multiple spectra in one plot, depending on the selection in the dropdown menu of
            the selected checkbox. You can compare different spectra with the same x and y ranges directly.
        </p>
        <p>The Spectral Profiler Widget supports four modes of multi-profile plot:</p>
        <ul>
            <li>
                When the <b>Image</b> checkbox is selected: spectra from <em>different spatially and spectrally matched images</em>, from the selected region with the selected statistic, and the selected polarization (if applicable), are
                displayed.
            </li>
            <li>
                When the <b>Region</b> checkbox is selected: spectra from <em>different regions</em> of the selected image (and the selected polarization if applicable) are displayed. The region spectra are computed with the selected
                statistic.
            </li>
            <li>
                When the <b>Statistic</b> checkbox is selected: spectra with <em>different statistical quantities</em> from the selected region of the selected image (and the selected polarization if applicable) are displayed.
            </li>
            <li>
                When the <b>Polarization</b> checkbox is selected: spectra with <em>different polarization components</em> from the selected image, the selected region and the selected statistic are displayed.
            </li>
        </ul>
        <p>
            In short, if multiple spectra are plotted, only one option (<b>Image</b>, <b>Region</b>, <b>Statistic</b> or <b>Polarization</b>) can be varied at a time. All other options are fixed to a single value.
        </p>
        <p>The cursor information of each profile is displayed in the bottom-left corner. The cursor information field can be resized.</p>

        <h3 id="images">Image dropdown menu</h3>
        <p>
            The <b>Image</b> dropdown menu defaults to "Active", which means the currently selected image. This is the image which is visible in the Image Viewer (if it is in the single-panel mode). If the viewer is in the multi-panel mode,
            the active image is highlighted with a red box. You may use the Animator Widget or the Image List Widget to change the active image.
        </p>
        <p>
            When the <b>Image</b> checkbox is selected and if there are spatially and spectrally matched images (apply matching via the Image List Widget), the dropdown menu will display an image list with information about the matching
            state. You can select one of the images to view its spectral profile. If the selected image is matched to other images, spectra from those images will be displayed in the Spectral Profiler Widget too, allowing a direct
            comparison of spectra from different image cubes.
        </p>
        <h3 id="regions">Region dropdown menu</h3>
        <p>
            The <b>Region</b> dropdown menu defaults to "Active", which means the region currently selected in the Image Viewer. You can select an active region by clicking one in the Image Viewer, or by clicking a region entry in the
            Region List Widget. The spectral profile plot of the selected active region will be updated accordingly. If no region is selected, the region defaults to cursor.
        </p>
        <p>
            When the <b>Region</b> checkbox is selected, the dropdown menu allows multiple selection. You can select different regions for profile calculations.{" "}
        </p>
        <h3>Statistic dropdown menu</h3>
        <p>
            The <b>Statistic</b> dropdown menu defaults to &quot;Mean&quot;. When the <b>Statistic</b> checkbox is selected, the dropdown menu allows multiple selection. You can select different statistical quantities for region spectral
            profile calculations.
        </p>
        <h3>Polarization dropdown menu</h3>
        <p>
            When the image in the view contains multiple polarization components, you can use the <b>Polarization</b> dropdown menu to view profiles from different Stokes as well as computed polarization components such as polarization
            intensity or polarization angle, etc.. The dropdown menu defaults to &quot;Current&quot;, meaning the polarization component selected via the Animator.
        </p>
        <p>
            When the <b>Polarization</b> checkbox is selected, the dropdown menu allows multiple selection. You can select different polarization components for region spectral profile calculations.
        </p>
        <h3 id="spectral-conventions-and-reference-frame">Spectral conventions, reference frame, and intensity conversion</h3>
        <p>
            With the <b>Conversion</b> tab of the Spectral Profiler Settings Dialog, you can change the spectral convention or display a secondary convention in the cursor information field, including:
        </p>
        <ul>
            <li>Radio velocity (km/s, m/s)</li>
            <li>Optical velocity (km/s, m/s)</li>
            <li>Frequency (GHz, MHz, kHz, Hz)</li>
            <li>Wavelength (m, mm, um, Angstrom)</li>
            <li>Air wavelength (m, mm, um, Angstrom)</li>
            <li>Channel</li>
        </ul>
        <p>the spectral reference frame, including:</p>
        <ul>
            <li>LSRK: the rest-frame of the kinematical local standard of rest</li>
            <li>LSRD: the rest-frame of the dynamical local standard of rest</li>
            <li>BARY: barycentric, the rest-frame of the solar-system barycenter</li>
            <li>TOPO: topocentric, the observer's rest-frame on Earth</li>
        </ul>
        <p>and the intensity unit such as &quot;Jy/beam&quot; &lt;-&gt; &quot;K&quot;, depending on the integrity of the image header.</p>
        <p>Note that depending on the integrity of image headers, some conversions may not be possible.</p>
        <h3 id="profile-smoothing">Profile smoothing</h3>
        <p>
            The displayed profile can be smoothed via the <b>Smoothing</b> tab of the Spectral Profiler Settings Dialog (the cog button). A shortcut button to the <b>Smoothing</b> tab can be found in the top-right corner of the widget.
        </p>
        <h3 id="moment-image-generator">Moment image generator</h3>
        <p>
            Moment images can be generated via the <b>Moments</b> tab of the Spectral Profiler Settings Dialog (the cog button). A shortcut button to the <b>Moments</b> tab can be found in the top-right corner of the widget.
        </p>
        <h3>Profile fitting</h3>
        <p>
            You can fit a model profile to a spectrum in the view via the <b>Fitting</b> tab of the Spectral Profiler Settings Dialog (the cog button). You can find a shortcut button to the <b>Fitting</b> tab in the top-right corner of the
            widget. Note that profile fitting is not allowed when there are multiple profiles in the plot.
        </p>
        <h3 id="profile-mean-and-rms">Profile mean and RMS</h3>
        <p>
            As an option in the <b>Styling</b> tab of the Spectral Profiler Settings Dialog, mean and RMS values of a single profile can be visualized as a green dashed line and a shaded area in the profile plot. Numeric values are
            displayed in the bottom-left corner. Note that CARTA includes all data in the current zoom level of the profile plot to perform the calculations. If the zoom level changes, mean and RMS values will be updated accordingly.
        </p>
        <h3 id="interactivity-zoom-pan-changing-channel">Interactivity: zoom, pan, changing channel</h3>
        <p>The x and y ranges of the spectral profile plot can be modified by</p>
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
            In addition, the x and y ranges can be explicitly set in the <b>Styling</b> tab of the Spectral Profiler Settings Dialog.
        </p>
        <p>
            You may click on the spectral profile plot to switch to a channel (as indicated by a red vertical line) and view the image in the Image Viewer. The red line is draggable and acts equivalently like the <b>Channel</b> slider in
            the Animator Widget.
        </p>
        <h3 id="exports">Profile export</h3>
        <p>The spectral profile plot can be exported as a PNG file or a text file in TSV format via the buttons in the bottom-right corner (shown when hovering over the plot).</p>
        <h3 id="plot-cosmetics">Plot cosmetics</h3>
        <p>
            The appearance of the spectral profile plot is customizable via the <b>Styling</b> tab of the Spectral Profiler Settings Dialog (the cog button). Supported options are:
        </p>
        <ul>
            <li>color of the plot</li>
            <li>plot styles including steps (default), lines, and dots</li>
            <li>line width for steps or lines</li>
            <li>point size for dots</li>
            <li>display mean and RMS</li>
            <li>plot x and y ranges</li>
        </ul>
        <br />

        <h4 id="note">NOTE</h4>
        <p>
            For performance concerns, a profile is decimated before rendering if the number of points of the profile is greater than the screen resolution of the Spectral Profiler Widget. The kernel size of profile decimation is dynamically
            adjusted so that profile features are mostly preserved. When decimation is applied, the line style of the profile plot is switched to &quot;line&quot;, regardless of the setting in the Spectral Profiler Settings Dialog. When no
            decimation is applied (e.g., at higher profile zoom level, or profile has fewer points than the screen resolution), the line style becomes &quot;step&quot; (as default in the <b>Styling</b> tab of the Spectral Profiler Settings
            Dialog).
        </p>
    </div>
);
