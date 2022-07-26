import {ImageComponent} from "../ImageComponent";
import demoImageOverlayOrientationMapping from "static/help/demo_image_overlay_orientation_mapping.png";
import demoImageOverlayOrientationMapping_d from "static/help/demo_image_overlay_orientation_mapping_d.png";

export const CATALOG_SETTINGS_ORIENTATION_HELP_CONTENT = (
    <div>
        <h3>Marker orientation</h3>
        <p>
            This dialog provides options to set the orientation of source markers of an image overlay. The shape of the marker can be set with the <code>Shape</code> dropdown menu. If the <code>Column</code> dropdown menu is None, all
            markers are rendered without without any additional rotation. You may assign a numeric data column for orientation mapping with the <code>Column</code> dropdown menu. Different scaling functions, orientation ranges, or clip
            bounds can be applied.
        </p>
        <p>
            <ImageComponent light={demoImageOverlayOrientationMapping} dark={demoImageOverlayOrientationMapping_d} width="100%" />
        </p>
    </div>
);
