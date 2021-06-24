import * as React from "react";
import {ImageComponent} from "./ImageComponent";
import demoImageOverlaySizeMapping from "static/help/demo_image_overlay_Size_mapping.png";
import demoImageOverlaySizeMapping_d from "static/help/demo_image_overlay_Size_mapping_d.png";

export class CatalogSettingsSizeHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <h3>Marker size</h3>
                <p>
                    This dialog provides options to set the size of source markers of an image overlay. If the <code>Column</code> dropdown menu is None, all markers are rendered with a uniform size as set with the <code>Size</code>{" "}
                    dropdown menu. You may assign a numeric data column for size mapping. Different scaling, size mode, size range, or clip bounds can be applied.
                </p>
                <p>
                    <ImageComponent light={demoImageOverlaySizeMapping} dark={demoImageOverlaySizeMapping_d} width="100%" />
                </p>
            </div>
        );
    }
}
