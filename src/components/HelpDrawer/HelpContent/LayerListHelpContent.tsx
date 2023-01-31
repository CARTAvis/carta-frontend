import widgetButtonImageList from "static/help/widgetButton_imageList.png";
import widgetButtonImageList_d from "static/help/widgetButton_imageList_d.png";

import {ImageComponent} from "../ImageComponent";

export const LAYER_LIST_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={widgetButtonImageList} dark={widgetButtonImageList_d} width="90%" />
        </p>
        <p>
            The image list widget displays all loaded images as a list, which includes the image name, rendering layers (R for raster, C for contours, V for vector field), layer visibility state, spatial matching state, spectral matching
            state, color range matching state, channel index, and polarization type. The channel index and polarization type are synchronized with the animator.
        </p>
        <p>
            You may click <code>R</code> to hide/show a raster layer, <code>C</code> to hide/show a contour layer, and <code>V</code> to hide/show a vector field layer.
        </p>
        <p>
            Per image, you can click the <code>XY</code> button to enable/disable spatial matching and click the <code>Z</code> button to enable/disable spectral matching. To match the color range to the reference image, click the{" "}
            <code>R</code> button.
        </p>
        <p>
            To change a reference image, <code>right-click</code> on a row to bring up the context menu. The spatial reference image, the spectral reference image, and the raster scaling reference image can be defined independently. By
            default, spectral matching is performed with respect to radio velocity convention. If other spectral conventions (e.g., frequency, channel, etc) are desired, use the <code>Matching</code> tab of the image list settings dialog
            (the <code>cog</code> at the top-right corner of the image list widget).
        </p>
        <p>
            When images are matched spectrally in the velocity domain, the rest frequency for the frequency-to-velocity conversion per image can be re-defined. This allows you to compare different spectral features efficiently without
            changing the RESTFRQ header iteratively and permanently. You can <code>right-click</code> on a row to bring up the context menu or use the <code>Rest Frequency</code> tab of the image list settings dialog.
        </p>
        <p>
            To close an image (or images), <code>right-click</code> on a row to bring up the context menu.
        </p>
        <p>
            The list order reflects the order of the image slider in the animator. When the image viewer is in the multi-panel mode, the list order also determines the image order in the grid layout following the left-right then top-down
            rule. To change the order, <code>drag-and-drop</code> an image in the list to the desired new position.
        </p>
    </div>
);
