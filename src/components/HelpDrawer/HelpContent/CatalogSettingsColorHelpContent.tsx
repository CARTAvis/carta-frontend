import demoImageOverlayColorMapping from "static/help/demo_image_overlay_color_mapping.png";
import demoImageOverlayColorMapping_d from "static/help/demo_image_overlay_color_mapping_d.png";

import {ImageComponent} from "../ImageComponent";

export const CATALOG_SETTINGS_COLOR_HELP_CONTENT = (
    <div>
        <h3>Marker color</h3>
        <p>
            This dialog provides options for enhancing the visual representation of source markers within an image overlay. This includes applying a color (<b>Color</b> dropdown menu) or a colormap (<b>Colormap</b> dropdown menu). The{" "}
            <b>Shape</b> dropdown menu can be used to configure the marker shape.
        </p>
        <p>
            If the <b>Column</b> dropdown menu is unselected (set to "None"), all markers are rendered in a single color as defined by the <b>Color</b> dropdown menu. However, you have the option of enhancing the visualization by selecting
            a numeric data column from the <b>Column</b> dropdown. This allows you to gain additional insights from your data by applying a color mapping. Customizable parameters include various scaling functions (<b>Scaling</b> dropdown
            menu), a selection of colormaps (<b>Colormap</b> dropdown menu and <b>Invert colormap</b> toggle), and adjustable clip bounds (<b>Clip min</b> and <b>Clip max</b> input fields).
        </p>

        <p>
            The overlay is updated dynamically whenever a source or a set of sources is selected in one of the linked widgets. The corresponding markers are rendered in a highlight colour which can be configured with the{" "}
            <b>Overlay highlight</b> dropdown menu. This provides a clear visual indicator of selected sources in the overlay.
        </p>
        <p>
            <ImageComponent light={demoImageOverlayColorMapping} dark={demoImageOverlayColorMapping_d} width="100%" />
        </p>
    </div>
);
