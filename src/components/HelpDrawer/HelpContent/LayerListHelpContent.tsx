import widgetButtonImageList from "static/help/widgetButton_imageList.png";
import widgetButtonImageList_d from "static/help/widgetButton_imageList_d.png";

import {ImageComponent} from "../ImageComponent";

export const LAYER_LIST_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={widgetButtonImageList} dark={widgetButtonImageList_d} width="90%" />
        </p>
        <p>
            The Image List Widget is a centralized location for basic information about all loaded images. Each entry includes the image name, rendering layers (designated as <b>R</b> for raster, <b>C</b> for contours, and <b>V</b> for
            vector field), layer visibility state, spatial matching state, spectral matching state, color range matching state, channel index, and polarization type. Note that the channel index and polarization type are synchronized with
            the Animator Widget.
        </p>
        <p>
            You can click the <b>R</b> button in an image entry to toggle the visibility of its raster layer. Similarly, the <b>C</b> and <b>V</b> buttons control the visibility of the image's contour and vector field layers, respectively.
        </p>
        <p>
            The <b>XY</b> button allows you to toggle an image's spatial matching. Similarly, the <b>Z</b> button controls spectral matching, an the <b>R</b> button toggles aligning the color range with the reference image.
        </p>
        <p>
            To change a reference image, <code>right-click</code> on a row to bring up the context menu. The spatial reference image, the spectral reference image, and the raster scaling reference image can be defined independently.
            Spectral matching defaults to the <em>radio velocity</em> convention, but an alternative spectral convention (such as frequency or channel) can be configured in the <b>Matching</b> tab of the Image List Settings Dialog
            (accessible through the cog icon at the top-right corner of the image list widget).
        </p>
        <p>
            When spectrally matching in the velocity domain, it is possible to redefine the rest frequency for frequency-to-velocity conversion per image. This enables efficient comparison of distinct spectral features without the need for
            permanent alterations to the <code>RESTFRQ</code> header. You can access this functionality either through <code>right-clicking</code> on a row or through the <b>Rest Frequency</b> tab in the Image List Settings Dialog.
        </p>
        <p>
            Images can also be closed from this widget: <code>right-click</code> on a row to access the context menu. Alternatively, to close the active image, use the <b>File</b> menu and select <b>Close Image</b>.
        </p>
        <p>
            The order of entries in the list matches the <b>Image</b> slider of the Animator. In the multi-panel view of the Image Viewer, this list order determines the arrangement of images according to the left-right and top-down
            pattern. Images in the list can be rearranged through <code>drag-and-drop</code>: click or click and drag in the index column to select one or more rows, then hover over the selected rows in the index column until an open hand
            cursor appears. You can then click and drag to move the rows. Click outside the index column to clear the selection.
        </p>
    </div>
);
