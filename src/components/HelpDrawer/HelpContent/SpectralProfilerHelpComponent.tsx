import * as React from "react";
import {ImageComponent} from "./ImageComponent";
import headSpectralButton from "static/help/head_spectral_button.png";
import headSpectralButton_d from "static/help/head_spectral_button_d.png";

export class SpectralProfilerHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p><ImageComponent light={headSpectralButton} dark={headSpectralButton_d} width="90%"/></p>
                <p>The spectral profiler widget allows users to view a region spectral profile of an image cube with a specific statistic (via the &quot;Statistic&quot; dropdown; default as mean). If Stokes axis exists, users may view a
                    specific Stokes via the &quot;Stokes&quot; dropdown.</p>
                <h3 id="images">Images</h3>
                <p>The image dropdown defaults to &quot;Active&quot; image which means the current image in the image viewer.</p>
                <h3 id="regions">Regions</h3>
                <p>The region dropdown defaults to &quot;Active&quot; region which means a selected region in the image viewer. Users can select a region by clicking one on the image viewer, or by clicking a region entry on the region list
                    widget. Spectral profile plot of the selected region will be updated accordingly. If no region is selected, &quot;Active&quot; region defaults to cursor.</p>
                <h3 id="responsive-and-progressive-profile-update">Responsive and progressive profile update</h3>
                <p>When a region spectral profile is requested, depending on the performance of the server, users may see profiles are updated piece by piece in regular interval. This feature provides a visual progress update for better
                    user experience. In addition, if users move a region while its spectral profile is being updating, the old calculations will be terminated immediately and calculations of the new region spectral profile will start and
                    users will see a partial profile in seconds.</p>
                <h3 id="spectral-conventions-and-reference-frame">Spectral conventions and reference frame</h3>
                <p>With the &quot;Conversion&quot; tab of the spectral profiler settings dialogue, users can change the spectral convention, including:</p>
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
                <h3 id="profile-smoothing">Profile smoothing</h3>
                <p>The displayed profile can be smoothed via the &quot;Smoothing&quot; tab of the spectral profiler settings dialogue (the cog icon). A shortcut button of the &quot;Smoothing&quot; tab can be found at the top-right corner of
                    the widget.</p>
                <h3 id="profile-mean-and-rms">Profile mean and RMS</h3>
                <p>As an option in the &quot;Styling&quot; tab of the spectral profiler settings dialogue, mean and RMS values of the profile can be visualized as a green dashed line and a shaded area in the profile plot. Numerical values
                    are displayed at the bottom-left corner. Note that CARTA includes all data in the current zoom level of the profile plot to perform the calculations. If zoom level changes, mean and RMS values will be updated too.</p>
                <h3 id="moment-image-generator">Moment image generator</h3>
                <p>Moment images can be generated via the &quot;Moments&quot; tab of the spectral profiler settings dialogue (the cog icon). A shortcut button of the &quot;Moments&quot; tab can be found at the top-right corner of the
                    widget.</p>
                <h3 id="interactivity-zoom-pan-changing-channel">Interactivity: zoom, pan, changing channel</h3>
                <p>The x and y ranges of the spectral profile plot can be modified by</p>
                <ul>
                    <li><code>scrolling wheel</code> (up to zoom in and down to zoom out with respect to the cursor position)</li>
                    <li><code>click-and-drag</code> horizontally to zoom in x</li>
                    <li><code>click-and-drag</code> vertically to zoom in y</li>
                    <li><code>click-and-drag</code> diagonally to zoom in both x and y</li>
                    <li><code>double-click</code> to reset x and y ranges</li>
                    <li><code>shift + click-and-drag</code> to pan in x</li>
                </ul>
                <p>In addition, the x and y ranges can be explicitly set in the &quot;Styling&quot; tab of the spectral profile settings dialogue.</p>
                <p>Users may click on the spectral profile plot to switch to a channel (as indicated by a red vertical line) and view the image in the image viewer. The red line is draggable and acts equivalently like the channel slider in
                    the animator widget.</p>
                <h3 id="exports">Exports</h3>
                <p>The spectral profile plot can be exported as a png file or a text file in tsv format via the buttons at the bottom-right corner (shown when hovering over the plot).</p>
                <h3 id="plot-cosmetics">Plot cosmetics</h3>
                <p>The appearance of the spectral profile plot is customizable via the &quot;Styling&quot; tab of the spectral profile settings dialogue (the cog icon). Supported options are:</p>
                <ul>
                    <li>color of the plot</li>
                    <li>plot styles including steps (default), lines, and dots</li>
                    <li>line width for steps or lines</li>
                    <li>point size for dots</li>
                </ul>
                <br/>
                <h4 id="note">NOTE</h4>
                <p>For performance concerns, a profile is decimated before rendering if the number of points of the profile is greater than the screen resolution of the spectral profiler widget. The kernel size of profile decimation is
                    dynamically adjusted so that profile features are mostly preserved. When decimation is applied, the line style of the profile plot is switched to &quot;line&quot;, regardless the setting in the spectral profiler settings
                    dialogue. When no decimation is applied (e.g., at higher profile zoom level, or profile has fewer points than the screen resolution), the line style becomes &quot;step&quot; (as default in the &quot;Styling&quot; tab of
                    the settings dialogue).</p>

            </div>
        );
    }
}
