export const LAYER_LIST_SETTINGS_HELP_CONTENT = (
    <div>
        <p>
            The image list settings dialog allows you to define a spectral convention for spectral matching with the <code>Matching</code> tab. The default, which can be configured in the <code>Global</code> tab of the preferences dialog, is radio velocity.
        </p>
        <p>
            A new rest frequency for the frequeny-to-velocity conversion can be set with the <code>Rest Frequency</code> tab. Each image, includeing the reference image, can have a new rest frequency. When images are matched spectrally in the velocity convension, the velocity axis per image is recomputed based on the new rest frequency. 
        </p>
    </div>
);