import demoImageOverlayColorMapping from "static/help/demo_image_overlay_color_mapping.png";
import demoImageOverlayColorMapping_d from "static/help/demo_image_overlay_color_mapping_d.png";

import {ImageComponent} from "../ImageComponent";

export const CATALOG_SETTINGS_COLOR_HELP_CONTENT = (
    <div>
        <h3>Marker color</h3>
        <p>
            Within this dialog, you are presented with a range of choices to enhance the visual representation of source markers within an image overlay. Key options encompass the application of colors or color maps, as well as the ability
            to define marker shapes through the Shape dropdown menu.
        </p>
        <p>
            When the Column dropdown menu remains unselected (set to "None"), all markers adopt a unified color as determined by the Color dropdown menu. However, should you opt to enhance your visualization, you have the flexibility to
            designate a numeric data column by choosing from the Column dropdown menu. This empowers you to leverage color mapping, thereby imparting nuanced insights to your data. Customizable parameters include various scaling functions,
            diverse color maps, and adjustable clip bounds.
        </p>

        <p>
            The interactive nature of this dialog is apparent when selecting sources or sets of sources. On such occasions, the marker colors transform to align with your choices as indicated within the Overlay highlight dropdown menu. This
            dynamic alteration provides a clear visual indicator of selected sources within your visualization.
        </p>
        <p>
            <ImageComponent light={demoImageOverlayColorMapping} dark={demoImageOverlayColorMapping_d} width="100%" />
        </p>
    </div>
);
