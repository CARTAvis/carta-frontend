import demoImageOverlaySizeMapping from "static/help/demo_image_overlay_Size_mapping.png";
import demoImageOverlaySizeMapping_d from "static/help/demo_image_overlay_Size_mapping_d.png";

import {ImageComponent} from "../ImageComponent";

export const CATALOG_SETTINGS_SIZE_HELP_CONTENT = (
    <div>
        <h3>Marker size</h3>
        <p>
            This dialog provides options for configuring the sizes of source markers within an image overlay (through the <b>Size</b> spinbox and the <b>Thickness</b> spinbox). The <b>Shape</b> dropdown menu can be used to configure the
            marker shape.
        </p>
        <p>
            If the <b>Column</b> dropdown menu is unselected (set to "None"), all markers are rendered at the same size, as configured with the <b>Size</b> spinbox. However, for a more insightful representation, you have the option of
            selecting a numeric data column from the <b>Column</b> dropdown. This allows you to apply a size mapping, and adjust the visual dimensions of the markers dynamically. This mapping can be enhanced further through various scaling
            functions (<b>Scaling</b> dropdown menu), size modes (<b>Size mode</b> buttons), adjustable size ranges (<b>Size min (px)</b> and <b>Size max (px)</b> input fields), and clip bounds (<b>Clip min</b> and <b>Clip max</b> input
            fields).
        </p>

        <p>
            If an ellipse is selected as the marker shape, the dialog provides an additional feature: the mapping of major and minor axes to distinct numeric columns via the <b>Major</b> and <b>Minor</b> tabs. This enables enhanced
            visualization use cases: for instance, mapping position errors onto markers with elliptical forms.
        </p>
        <p>
            <ImageComponent light={demoImageOverlaySizeMapping} dark={demoImageOverlaySizeMapping_d} width="100%" />
        </p>
    </div>
);
