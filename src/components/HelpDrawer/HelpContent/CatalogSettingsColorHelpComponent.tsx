import * as React from "react";
import {ImageComponent} from "./ImageComponent";
import demoImageOverlayColorMapping from "static/help/demo_image_overlay_color_mapping.png";
import demoImageOverlayColorMapping_d from "static/help/demo_image_overlay_color_mapping_d.png";

export class CatalogSettingsColorHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <h3>Marker color</h3>
                <p>This dialog provides options to set the color or colormap to source markers of an image overlay. If the <code>Column</code> dropdown menu is None, all markers are rendered with a single color as set with the <code>Color</code> dropdown menu. You may assign a numeric data column for color mapping. Different scaling, colormap, or clip bounds can be applied.</p>
                <p><ImageComponent light={demoImageOverlayColorMapping} dark={demoImageOverlayColorMapping_d} width="100%"/></p>
            </div>
        );
    }
}
