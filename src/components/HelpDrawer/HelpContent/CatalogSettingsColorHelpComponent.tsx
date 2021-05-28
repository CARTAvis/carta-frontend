import * as React from "react";
import {ImageComponent} from "./ImageComponent";
import demoImageOverlayColorMapping from "static/help/demo_image_overlay_color_mapping.png";
import demoImageOverlayColorMapping_d from "static/help/demo_image_overlay_color_mapping_d.png";

export class CatalogSettingsColorHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <h3>Marker color</h3>
                <p>This dialogue provides options to define a color or a colormap to source markers of an image overlay. If the &quot;Column&quot; dropdown menu is None, all markers are rendered with a single color as defined with the &quot;Color&quot; dropdown menu. Users may assign a numeric data column for color mapping. Different scaling, colormap, or clip bounds can be applied.</p>
                <p><ImageComponent light={demoImageOverlayColorMapping} dark={demoImageOverlayColorMapping_d} width="100%"/></p>
            </div>
        );
    }
}
