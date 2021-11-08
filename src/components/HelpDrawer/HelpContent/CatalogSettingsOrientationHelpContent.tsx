import {ImageComponent} from "../ImageComponent";
import demoImageOverlayOrientationMapping from "static/help/demo_image_overlay_orientation_mapping.png";
import demoImageOverlayOrientationMapping_d from "static/help/demo_image_overlay_orientation_mapping_d.png";

export const CATALOG_SETTINGS_ORIENTATION_HELP_CONTENT = (
    <div>
        <h3>Marker orientation</h3>
        <p>
            This dialog provides options to set the orientation of source markers of an image overlay. If the <code>Column</code> dropdown menu is None, all markers are rendered without applying an additional rotation applied. You may
            assign a numeric data column for orientation mapping. Different scaling, orientation range, or clip bounds can be applied.
        </p>
        <p>
            <ImageComponent light={demoImageOverlayOrientationMapping} dark={demoImageOverlayOrientationMapping_d} width="100%" />
        </p>
    </div>
);
