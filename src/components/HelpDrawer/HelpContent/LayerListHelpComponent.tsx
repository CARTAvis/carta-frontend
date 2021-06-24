import * as React from "react";
import {ImageComponent} from "./ImageComponent";
import headLayerButton from "static/help/head_layer_button.png";
import headLayerButton_d from "static/help/head_layer_button_d.png";

export class LayerListHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p>
                    <ImageComponent light={headLayerButton} dark={headLayerButton_d} width="90%" />
                </p>
                <p>
                    The image list widget displays loaded images as a list, which includes the image name, rendering layers (R for raster and C for contours), layer visibility state, WCS matching state, color range matching state, channel
                    index, and Stokes index. The channel index and Stokes index are synchronized with the animator.
                </p>
                <p>
                    You may click <code>R</code> and/or <code>C</code> to hide/show a layer. For example, if you want to generate an image with contours only, you can hide raster layers by clicking <code>R</code>.
                </p>
                <p>
                    Per image, you can click the <code>XY</code> button to enable/disable spatial matching and click the <code>Z</code> button to enable/disable spectral matching. To match color range to the reference image, click the{" "}
                    <code>R</code> button.
                </p>
                <p>
                    To change reference image, <code>right-click</code> on a row to bring up the menu.
                </p>
                <p>
                    To close an image (or images), <code>right-click</code> on a row to bring up the menu.
                </p>
                <p>
                    The list order reflects the order of the image slider in the animator. To change the order, <code>click</code> to select an entry and <code>drag-and-drop</code> it to the desired position.
                </p>
            </div>
        );
    }
}
