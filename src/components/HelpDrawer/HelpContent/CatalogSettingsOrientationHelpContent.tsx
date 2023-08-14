import demoImageOverlayOrientationMapping from "static/help/demo_image_overlay_orientation_mapping.png";
import demoImageOverlayOrientationMapping_d from "static/help/demo_image_overlay_orientation_mapping_d.png";

import {ImageComponent} from "../ImageComponent";

export const CATALOG_SETTINGS_ORIENTATION_HELP_CONTENT = (
    <div>
        <h3>Marker orientation</h3>
        <p>Within this dialog, a spectrum of choices awaits you for configuring the orientation of source markers within an image overlay. This flexibility extends to marker shapes, which can be designated using the Shape dropdown menu.</p>
        <p>
            Should the Column dropdown menu remain unselected (set to "None"), all markers will be displayed without any additional rotation. However, for a more insightful visualization, you have the option to allocate a numeric data
            column through the Column dropdown menu. This empowers you to leverage orientation mapping, allowing you to dynamically adjust marker angles. This mapping can be further enhanced through various scaling functions, diverse
            orientation ranges, and adjustable clip bounds.
        </p>
        <p>The comprehensive nature of this dialog ensures that you can tailor your visual representation to align with the nuances of your data.</p>
        <p>
            <ImageComponent light={demoImageOverlayOrientationMapping} dark={demoImageOverlayOrientationMapping_d} width="100%" />
        </p>
    </div>
);
