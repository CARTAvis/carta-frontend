export const LAYER_LIST_SETTINGS_HELP_CONTENT = (
    <div>
        <h3>Matching</h3>
        <p>
            Within the image list settings dialog, you are afforded the capability to establish a spectral convention tailored to your preferences, specifically designed for spectral matching. This functionality is encapsulated within the
            Matching tab.
        </p>
        <p>
            It's noteworthy that the default spectral convention, which is subject to modification through the Global tab of the preferences dialog, is set to radio velocity. This ensures that the application aligns with your personalized
            spectral referencing conventions.
        </p>
        <h3>Rest Frequency</h3>
        <p>
            A new rest frequency for the frequency-to-velocity conversion can be set with the <code>Rest Frequency</code> tab. Each image, including the reference image, can have a new rest frequency. When images are matched spectrally in
            the velocity convention, the velocity axis per image is recomputed based on the new rest frequency.
        </p>
    </div>
);
