import * as React from "react";
import * as underConstruction from "static/help/under_construction.png";

export class StokesAnalysisSettingsHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p>The Stokes analysis settings dialogue allows users to</p>
                <ul>
                    <li>change the spectral convention and reference frame</li>
                    <li>customize profile plot appearance</li>
                    <li>customize scatter plot appearance</li>
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
                <p>In addition, the appearance of the scatter plot can be customized too, including:</p>
                <ul>
                    <li>Colormap</li>
                    <li>Symbol size</li>
                    <li>Symbol transparency</li>
                    <li>Q-to-U scale ratio as unity</li>
                </ul>
            </div>
        );
    }
}
