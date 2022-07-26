import {ImageComponent} from "../ImageComponent";
import widgetButtonSpectralProfiler from "static/help/widgetButton_spectralProfiler.png";
import widgetButtonSpectralProfiler_d from "static/help/widgetButton_spectralProfiler_d.png";

export const SPECTRAL_PROFILER_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={widgetButtonSpectralProfiler} dark={widgetButtonSpectralProfiler_d} width="90%" />
        </p>
        <p>
            The spectral profiler widget provides two different modes of viewing spectral profiles, depending on the states of the <code>Image</code> checkbox, the <code>Region</code> checkbox, the <code>Statistic</code> checkbox, and the{" "}
            <code>Stokes</code> checkbox.{" "}
        </p>
        <p>
            When none of the checkboxes is selected, the spectral profiler widget displays only one spectrum at a time. You can view a region spectral profile (via the <code>Region</code> dropdown menu) of an image cube (via the{" "}
            <code>Image</code> dropdown menu) with a specific statistic (via the <code>Statistic</code> dropdown menu; the default is mean). If the polarization axis exists, you may view a specific polarization component via the{" "}
            <code>Polarization</code> dropdown menu. You may have multiple widgets to view spectra side by side.
        </p>
        <p>
            When one of the checkboxes (Image/Region/Statistic/Polarization) is selected, the spectral profiler widget can display multiple spectra in one plot, depending on the selection in the dropdown menu of the selected checkbox. You
            can compare different spectra with the same x and y ranges directly.
        </p>
        <p>The spectral profiler widget supports four modes of multi-profile plot:</p>
        <ul>
            <li>
                When the <code>Image</code> checkbox is selected: spectra from <em>different spatially and spectrally matched images</em>, from the selected region with the selected statistic, and the selected polarization (if applicable),
                are displayed.
            </li>
            <li>
                When the <code>Region</code> checkbox is selected: spectra from <em>different regions</em> of the selected image (and the selected polarization if applicable) are displayed. The region spectra are computed with the selected
                statistic.
            </li>
            <li>
                When the <code>Statistic</code> checkbox is selected: spectra with <em>different statistical quantities</em> from the selected region of the selected image (and the selected polarization if applicable) are displayed.
            </li>
            <li>
                When the <code>Polarization</code> checkbox is selected: spectra with <em>different polarization components</em> from the selected image, the selected region and the selected statistic are displayed.
            </li>
        </ul>
        <p>In short, if multiple spectra are plotted, only one option (Image, Region, Statistic or Polarization) can be varied at a time. All other options are fixed to a single value.</p>
        <p>The cursor information of each profile is displayed at the bottom-left corner. The cursor information box can be resized.</p>

        <h4>LIMITATION</h4>
        <p>
            If the intensity units of different matched cubes are different (e.g., Jy/beam vs Kelvin), <em>no</em> unit conversion is applied in the multi-profile plot. Intensity unit conversion is only available with a <em>single</em>{" "}
            profile with the <code>Conversion</code> tab of the spectral profiler settings dialog (the <code>cog</code> button at the top right corner of the widget).
        </p>

        <h3 id="images">Image dropdown menu</h3>
        <p>
            The image dropdown menu defaults to &quot;Active&quot; image which means the current image in the image viewer if it is in single-panel mode. If it is in multi-panel mode, the active image is highlighted with a red box. You may
            use the animator widget or the image list widget to change the active image.
        </p>
        <p>
            When the <code>Image</code> checkbox is selected and if there are spatially and spectrally matched images (apply matching via the image list widget), the dropdown menu will display an image list with information about the
            matching state. You can select one of the images to view its spectral profile. If the selected image is matched to other images, spectra from those images will be displayed in the spectral profiler widget too, allowing a direct
            comparison of spectra from different image cubes.
        </p>
        <h3 id="regions">Region dropdown menu</h3>
        <p>
            The region dropdown menu defaults to &quot;Active&quot; region which means the selected region in the image viewer. You can select an active region by clicking one on the image viewer, or by clicking a region entry in the region
            list widget. The spectral profile plot of the selected active region will be updated accordingly. If no region is selected, the region defaults to cursor.
        </p>
        <p>
            When the <code>Region</code> checkbox is selected, the dropdown menu allows multiple selection. You can select different regions for profile calculations.{" "}
        </p>
        <h3>Statistic dropdown menu</h3>
        <p>
            The statistic dropdown menu defaults to &quot;Mean&quot;. When the <code>Statistic</code> checkbox is selected, the dropdown menu allows multiple selection. You can select different statistical quantities for region spectral
            profile calculations.
        </p>
        <h3>Polarization dropdown menu</h3>
        <p>
            When the image in the view contains multiple polarization components, you can use this dropdown menu to view profiles from different Stokes as well as computed polarization components such as polarization intensity or
            polarization angle, etc.. The dropdown menu defaults to &quot;Current&quot;, meaning the polarization component selected via the animator.
        </p>
        <p>
            When the <code>Polarization</code> checkbox is selected, the dropdown menu allows multiple selection. You can select different polarization components for region spectral profile calculations.
        </p>
        <h3 id="spectral-conventions-and-reference-frame">Spectral conventions and reference frame</h3>
        <p>
            With the <code>Conversion</code> tab of the spectral profiler settings dialog, you can change the spectral convention, including:
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
            The displayed profile can be smoothed via the <code>Smoothing</code> tab of the spectral profiler settings dialog (the <code>cog</code> button). A shortcut button to the <code>Smoothing</code> tab can be found at the top-right
            corner of the widget.
        </p>
        <h3 id="moment-image-generator">Moment image generator</h3>
        <p>
            Moment images can be generated via the <code>Moments</code> tab of the spectral profiler settings dialog (the <code>cog</code> button). A shortcut button to the <code>Moments</code> tab can be found at the top-right corner of
            the widget.
        </p>
        <h3>Profile fitting</h3>
        <p>
            You can fit a model profile to a spectrum in the view via the <code>Fitting</code> tab of the spectral profiler settings dialog (the <code>cog</code> button). You can find a shortcut button to the <code>Fitting</code> tab at the
            top-right corner of the widget. Note that profile fitting is not allowed when there are multiple profiles in the plot.
        </p>
        <h3 id="responsive-and-progressive-profile-update">Responsive and progressive profile update</h3>
        <p>
            When a region spectral profile is requested, depending on the performance of the server, you may see profiles are updated piece by piece with a regular interval. This feature provides a visual progress update for better user
            experience. In addition, if you move a region while its spectral profile is updating, the old calculations will be terminated immediately and calculations of the new region spectral profile will start. You will see a partial
            profile in seconds.
        </p>
        <h3 id="profile-mean-and-rms">Profile mean and RMS</h3>
        <p>
            As an option in the <code>Styling</code> tab of the spectral profiler settings dialog, mean and RMS values of a single profile can be visualized as a green dashed line and a shaded area in the profile plot. Numerical values are
            displayed at the bottom-left corner. Note that CARTA includes all data in the current zoom level of the profile plot to perform the calculations. If the zoom level changes, mean and RMS values will be updated too.
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
            In addition, the x and y ranges can be explicitly set in the <code>Styling</code> tab of the spectral profile settings dialog.
        </p>
        <p>
            You may click on the spectral profile plot to switch to a channel (as indicated by a red vertical line) and view the image in the image viewer. The red line is draggable and acts equivalently like the channel slider in the
            animator widget.
        </p>
        <h3 id="exports">Profile export</h3>
        <p>The spectral profile plot can be exported as a png file or a text file in tsv format via the buttons at the bottom-right corner (shown when hovering over the plot).</p>
        <h3 id="plot-cosmetics">Plot cosmetics</h3>
        <p>
            The appearance of the spectral profile plot is customizable via the <code>Styling</code> tab of the spectral profile settings dialog (the <code>cog</code> button). Supported options are:
        </p>
        <ul>
            <li>color of the plot</li>
            <li>plot styles including steps (default), lines, and dots</li>
            <li>line width for steps or lines</li>
            <li>point size for dots</li>
            <li>display mean and RMS</li>
            <li>x and y ranges</li>
        </ul>
        <br />

        <h4 id="note">NOTE</h4>
        <p>
            For performance concerns, a profile is decimated before rendering if the number of points of the profile is greater than the screen resolution of the spectral profiler widget. The kernel size of profile decimation is dynamically
            adjusted so that profile features are mostly preserved. When decimation is applied, the line style of the profile plot is switched to &quot;line&quot;, regardless of the setting in the spectral profiler settings dialog. When no
            decimation is applied (e.g., at higher profile zoom level, or profile has fewer points than the screen resolution), the line style becomes &quot;step&quot; (as default in the <code>Styling</code> tab of the settings dialog).
        </p>
    </div>
);
