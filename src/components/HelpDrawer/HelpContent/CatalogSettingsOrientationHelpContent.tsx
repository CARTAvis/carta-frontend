import demoImageOverlayOrientationMapping from "static/help/demo_image_overlay_orientation_mapping.png";
import demoImageOverlayOrientationMapping_d from "static/help/demo_image_overlay_orientation_mapping_d.png";

import {ImageComponent} from "../ImageComponent";

export const CATALOG_SETTINGS_ORIENTATION_HELP_CONTENT = (
    <div>
        <h3>Marker orientation</h3>
        <p>
            This dialog provides options for configuring the orientation of source markers within an image overlay. The <b>Shape</b> dropdown menu can be used to configure the marker shape.
        </p>
        <p>
            If the <b>Column</b> dropdown menu is unselected (set to "None"), all markers are displayed without any additional rotation. However, you have the option of enhancing the visualization by selecting a numeric data column from the{" "}
            <b>Column</b> dropdown. This allows you to apply an orientation mapping, and adjust marker angles dynamically. This mapping can be enhanced further through various scaling functions (<b>Scaling</b> dropdown menu), orientation
            ranges (<b>Orientation min (degree)</b> and <b>Orientation max (degree)</b> input fields), and adjustable clip bounds (<b>Clip min</b> and <b>Clip max</b> input fields).
        </p>
        <p>
            <ImageComponent light={demoImageOverlayOrientationMapping} dark={demoImageOverlayOrientationMapping_d} width="100%" />
        </p>
    </div>
);
