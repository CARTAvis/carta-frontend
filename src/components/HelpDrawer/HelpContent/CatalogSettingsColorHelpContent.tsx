import {ImageComponent} from "../ImageComponent";
import demoImageOverlayColorMapping from "static/help/demo_image_overlay_color_mapping.png";
import demoImageOverlayColorMapping_d from "static/help/demo_image_overlay_color_mapping_d.png";

export const CATALOG_SETTINGS_COLOR_HELP_CONTENT = (
    <div>
        <h3>Marker color</h3>
        <p>
            This dialog provides options to apply a color or a color map to source markers of an image overlay. The shape of the marker can be set with the <code>Shape</code> dropdown menu. If the <code>Column</code> dropdown menu is None,
            all markers are rendered with a single color as set with the <code>Color</code> dropdown menu. You may assign a numeric data column with the <code>Column</code> dropdown menu for color mapping. Different scaling functions, color
            maps, or clip bounds can be applied. When a source or a set of sources is selected, the marker color is changed to the color as specified with the <code>Overlay Highlight</code> dropdown menu.
        </p>
        <p>
            <ImageComponent light={demoImageOverlayColorMapping} dark={demoImageOverlayColorMapping_d} width="100%" />
        </p>
    </div>
);
