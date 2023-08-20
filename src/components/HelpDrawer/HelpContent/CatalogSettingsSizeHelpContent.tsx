import demoImageOverlaySizeMapping from "static/help/demo_image_overlay_Size_mapping.png";
import demoImageOverlaySizeMapping_d from "static/help/demo_image_overlay_Size_mapping_d.png";

import {ImageComponent} from "../ImageComponent";

export const CATALOG_SETTINGS_SIZE_HELP_CONTENT = (
    <div>
        <h3>Marker size</h3>
        <p>
            Contained within this dialog are a set of choices for customizing the sizes of source markers within an image overlay. The ability to shape markers is granted through the <b>Shape</b> dropdown menu, the <b>Size</b> spinbox and
            the <b>Thickness</b> spinbox.
        </p>
        <p>
            When the <b>Column</b> dropdown menu remains unselected (set to "None"), all markers maintain a consistent size, determined by the value you set using the <b>Size</b> spinbox. Alternatively, for a more insightful representation,
            you have the option to assign a numeric data column via the <b>Column</b> dropdown menu. This facilitates size mapping, allowing for dynamic adjustment of marker visual dimensions. This mapping can be further enriched by
            incorporating different scaling functions (<b>Scaling</b> dropdown menu), varied size modes (<b>Size mode</b> buttons), adjustable size ranges (<b>Size min (px)</b> and <b>Size max (px)</b> input fields), and clip bounds (
            <b>Clip min</b> and <b>Clip max</b> input fields).
        </p>

        <p>
            An added layer of adaptability is introduced when considering marker shapes. If the shape selected is an ellipse, the dialog accommodates the mapping of major and minor axes to distinct numeric columns via the <b>Major</b> and{" "}
            <b>Minor</b> tabs. This enables enhanced visualization use cases, for instance, by mapping position errors onto markers with elliptical forms.
        </p>
        <p>
            <ImageComponent light={demoImageOverlaySizeMapping} dark={demoImageOverlaySizeMapping_d} width="100%" />
        </p>
    </div>
);
