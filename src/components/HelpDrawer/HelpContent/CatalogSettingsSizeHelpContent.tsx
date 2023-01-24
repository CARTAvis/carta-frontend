import demoImageOverlaySizeMapping from "static/help/demo_image_overlay_Size_mapping.png";
import demoImageOverlaySizeMapping_d from "static/help/demo_image_overlay_Size_mapping_d.png";

import {ImageComponent} from "../ImageComponent";

export const CATALOG_SETTINGS_SIZE_HELP_CONTENT = (
    <div>
        <h3>Marker size</h3>
        <p>
            This dialog provides options to set the sizes of source markers of an image overlay. The shape of the marker can be set with the <code>Shape</code> dropdown menu. If the <code>Column</code> dropdown menu is None, all markers are
            rendered with a uniform size as set with the <code>Size</code> spinbox. You may assign a numeric data column for size mapping with the <code>Column</code> dropdown menu. Different scaling functions, size modes, size ranges, or
            clip bounds can be applied. If the marker shape is ellipse, the major and minor axes can be mapped to different numeric columns (e.g., position errors), respectively.
        </p>
        <p>
            <ImageComponent light={demoImageOverlaySizeMapping} dark={demoImageOverlaySizeMapping_d} width="100%" />
        </p>
    </div>
);
