export const SPECTRAL_PROFILER_SETTINGS_CONVERSION_HELP_CONTENT = (
    <div>
        <h3>Conversion</h3>
        <p>
            With the <code>Conversion</code> tab, you can change the spectral convention, including:
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
        <p>and the intensity unit such as &quot;Jy/beam&quot; &lt;-&gt; &quot;K&quot;, depending on the integrity image header.</p>
        <p>Note that depending on the integrity of image headers, some conversions may not be possible.</p>
        <br />
        <h4>NOTE</h4>
        Intensity unit conversion currently works only with a <em>single</em> spectral profile. The support for the multi-profile mode will be implemented in a future release. 
    </div>
);
