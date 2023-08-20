import demoImageOverlayOrientationMapping from "static/help/demo_image_overlay_orientation_mapping.png";
import demoImageOverlayOrientationMapping_d from "static/help/demo_image_overlay_orientation_mapping_d.png";

import {ImageComponent} from "../ImageComponent";

export const CATALOG_SETTINGS_ORIENTATION_HELP_CONTENT = (
    <div>
        <h3>Marker orientation</h3>
        <p>
            Within this dialog, a spectrum of choices awaits you for configuring the orientation of source markers within an image overlay. This flexibility extends to marker shape, which can be designated using the <b>Shape</b> dropdown
            menu.
        </p>
        <p>
            Should the <b>Column</b> dropdown menu remain unselected (set to "None"), all markers will be displayed without any additional rotation. However, for a more insightful visualization, you have the option to allocate a numeric
            data column through the <b>Column</b> dropdown menu. This empowers you to leverage orientation mapping, allowing you to dynamically adjust marker angles. This mapping can be further enhanced through various scaling functions (
            <b>Scaling</b> dropdown menu), diverse orientation ranges (<b>Orientation min (degree)</b> and <b>Orientation max (degree)</b> input fields), and adjustable clip bounds (<b>Clip min</b> and <b>Clip max</b> input fields).
        </p>
        <p>
            <ImageComponent light={demoImageOverlayOrientationMapping} dark={demoImageOverlayOrientationMapping_d} width="100%" />
        </p>
    </div>
);
