import demoImageOverlaySizeMapping from "static/help/demo_image_overlay_Size_mapping.png";
import demoImageOverlaySizeMapping_d from "static/help/demo_image_overlay_Size_mapping_d.png";

import {ImageComponent} from "../ImageComponent";

export const CATALOG_SETTINGS_SIZE_HELP_CONTENT = (
    <div>
        <h3>Marker size</h3>
        <p>Contained within this dialog are a set of choices for customizing the sizes of source markers within an image overlay. The ability to shape markers is granted through the Shape dropdown menu.</p>
        <p>
            When the Column dropdown menu remains unselected (set to "None"), all markers maintain a consistent size, determined by the value you set using the Size spinbox. Alternatively, for a more nuanced representation, you have the
            option to assign a numeric data column via the Column dropdown menu. This facilitates size mapping, allowing for dynamic adjustment of marker dimensions. This mapping can be further enriched by incorporating different scaling
            functions, varied size modes, adjustable size ranges, and clip bounds.
        </p>

        <p>
            An added layer of adaptability is introduced when considering marker shapes. If the shape selected is an ellipse, the dialog accommodates the mapping of major and minor axes to distinct numeric columns. This opens avenues for
            enhanced visualization, for instance, by mapping position errors onto markers with elliptical forms.
        </p>
        <p>
            <ImageComponent light={demoImageOverlaySizeMapping} dark={demoImageOverlaySizeMapping_d} width="100%" />
        </p>
    </div>
);
