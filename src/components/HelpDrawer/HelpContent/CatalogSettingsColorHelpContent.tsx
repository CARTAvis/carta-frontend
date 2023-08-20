import demoImageOverlayColorMapping from "static/help/demo_image_overlay_color_mapping.png";
import demoImageOverlayColorMapping_d from "static/help/demo_image_overlay_color_mapping_d.png";

import {ImageComponent} from "../ImageComponent";

export const CATALOG_SETTINGS_COLOR_HELP_CONTENT = (
    <div>
        <h3>Marker color</h3>
        <p>
            Within this dialog, you are presented with a range of choices to enhance the visual representation of source markers within an image overlay. Key options encompass the application of color (<b>Color</b> dropdown menu) or
            colormap (<b>Colormap</b> dropdown menu), as well as the ability to define a marker shape through the <b>Shape</b> dropdown menu.
        </p>
        <p>
            When the <b>Column</b> dropdown menu remains unselected (set to "None"), all markers adopt a unified color as determined by the <b>Color</b> dropdown menu. However, should you opt to enhance your visualization, you have the
            flexibility to designate a numeric data column by choosing from the <b>Column</b> dropdown menu. This empowers you to leverage color mapping, thereby revealing hidden insights in your data. Customizable parameters include
            various scaling functions (<b>Scaling</b> dropdown menu), diverse colormaps (<b>Colormap</b> dropdown menu and <b>Invert colormap</b> toggle), and adjustable clip bounds (<b>Clip min</b> and <b>Clip max</b> input fields).
        </p>

        <p>
            The interactive nature of this dialog is apparent when selecting sources or sets of sources. On such occasions, the marker colors transform to align with your choices as indicated within the <b>Overlay highlight</b> dropdown
            menu. This dynamic alteration provides a clear visual indicator of selected sources within your visualization.
        </p>
        <p>
            <ImageComponent light={demoImageOverlayColorMapping} dark={demoImageOverlayColorMapping_d} width="100%" />
        </p>
    </div>
);
