import * as React from "react";
import {ImageComponent} from "./ImageComponent";
import headLayerButton from "static/help/head_layer_button.png";
import headLayerButton_d from "static/help/head_layer_button_d.png";

export class LayerListHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p><ImageComponent light={headLayerButton} dark={headLayerButton_d} width="90%"/></p>
                <p>The image list widget displays loaded images as a list, which includes image name, rendering layers (R as raster and C as contours) and layer visibility state, WCS matching state, color range matching state, channel index, and Stokes index. The channel index and Stokes index are synchronized with the animator.</p>
                <p>Users may click &quot;R&quot; and/or &quot;C&quot; to hide/show a layer. For example, if users want to generate an image with contours only, users can hide raster layers by clicking &quot;R&quot;.</p>
                <p>Per image, users can click the &quot;XY&quot; button to enable/disable spatial matching and click &quot;Z&quot; button to enable/disable spectral matching. To match color range to the reference image, click &quot;R&quot; button.</p>
                <p>To change reference image, <code>right-click</code> on a row to bring up the menu.</p>
                <p>To close an image (or images), <code>right-click</code> on a row to bring up the menu.</p>
                <p>The list order reflects the order of the image slider in the animator. The order may be modified by selecting an entry by <code>click</code> then <code>drag-and-drop</code> to form a desired order.</p>
            </div>
        );
    }
}
