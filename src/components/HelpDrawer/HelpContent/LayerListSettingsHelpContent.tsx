export const LAYER_LIST_SETTINGS_HELP_CONTENT = (
    <div>
        <h3>Matching</h3>
        <p>
            Within the <b>Matching</b> tab of the Image List Settings Dialog, you can configure the spectral convention for spectral matching. The default is radio velocity which fits the general use cases. This default can be customized
            with the <b>Spectral matching</b> dropdown menu in the <b>Global</b> tab of the Preferences Dialog (<b>File -&gt; Preferences</b>).
        </p>
        <h3>Rest Frequency</h3>
        <p>
            A new rest frequency for the frequency-to-velocity conversion can be set with the <b>Rest Frequency</b> tab. Each image, including the reference image, can have a new rest frequency. When images are matched spectrally in the
            velocity convention, the velocity axis per image is recomputed based on the new rest frequency.
        </p>
    </div>
);
