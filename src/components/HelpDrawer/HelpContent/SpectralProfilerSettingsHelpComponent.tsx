import * as React from "react";

export class SpectralProfilerSettingsHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p>The spectral profiler settings dialogue allows users to</p>
                <ul>
                    <li>change the spectral convention and reference frame</li>
                    <li>customize plot appearance</li>
                </ul>
                <h3 id="spectral-conventions-and-reference-frame">Spectral conventions and reference frame</h3>
                <p>With the spectral profiler settings dialogue, users can change the spectral convention, including:</p>
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
                <h3 id="plot-cosmetics">Plot cosmetics</h3>
                <p>The appearance of the spectral profile plot is customizable via the spectral profile settings dialogue (the cog icon). Supported options are:</p>
                <ul>
                    <li>color of the plot</li>
                    <li>plot styles including steps (default), lines, and dots</li>
                    <li>line width for steps or lines</li>
                    <li>point size for dots</li>
                </ul>
                <h3 id="profile-mean-and-rms">Profile mean and RMS</h3>
                <p>As an option in the spectral profiler settings dialogue, mean and RMS values of the profile can be visualized as a green dashed line and a shaded area in the profile plot. Numerical values are displayed at the bottom-left
                    corner. Note that CARTA includes all data in the current zoom level of the profile plot to perform the calculations. If zoom level changes, mean and RMS values will be updated too.</p>

            </div>
        );
    }
}
