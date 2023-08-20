import widgetButtonImageList from "static/help/widgetButton_imageList.png";
import widgetButtonImageList_d from "static/help/widgetButton_imageList_d.png";

import {ImageComponent} from "../ImageComponent";

export const LAYER_LIST_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={widgetButtonImageList} dark={widgetButtonImageList_d} width="90%" />
        </p>
        <p>
            The Image List Widget serves as a centralized place to show basic information of all loaded images. Each entry includes the image name, rendering layers (designated as <b>R</b> for raster, <b>C</b> for contours, and <b>V</b> for
            vector field), layer visibility status, spatial matching state, spectral matching status, color range matching state, channel index, and polarization type. Notably, the channel index and polarization type are synchronized with
            the Animator Widget.
        </p>
        <p>
            To configure the layer visibility, you can leverage designated buttons: clicking <b>R</b> toggles the visibility of raster layers, <b>C</b> manages the visibility of contour layers, and <b>V</b> controls the visibility of vector
            field layers.
        </p>
        <p>
            Per image, you retain the flexibility to manage spatial and spectral matching. By clicking the <b>XY</b> button, spatial matching can be enabled or disabled, while the <b>Z</b> button serves a similar purpose for spectral
            matching. To align the color range with the reference image, clicking the <b>R</b> button accomplishes this task.
        </p>
        <p>
            Should the need arise to change the reference image, a <code>right-click</code> on a row unveils a context menu. Through this menu, you can independently define the spatial reference image, spectral reference image, and raster
            scaling reference image. Additionally, spectral matching defaults to the <em>radio velocity</em> convention, but if alternative spectral conventions (such as frequency or channel) are desired, the <b>Matching</b> tab within the
            Image List Settings Dialog (accessed via the cog icon at the widget's top-right corner) offers configuration options.
        </p>
        <p>
            When spectrally matching in the velocity domain, the ability to redefine the rest frequency for frequency-to-velocity conversion per image is noteworthy. This affords efficient comparison of distinct spectral features without
            the need for permanent alterations to the <code>RESTFRQ</code> header. You can engage this functionality either through <code>right-clicking</code> on a row or by utilizing the <b>Rest Frequency</b> tab in the Image List
            Settings Dialog.
        </p>
        <p>
            Closing images is also seamless: a <code>right-click</code> on a row presents the context menu, or you can employ the <b>File</b> menu and select <b>Close Image</b>.
        </p>
        <p>
            Furthermore, the sequence of entries in the list mirrors the order within the <b>Image</b> slider of the Animator. In the multi-panel view of the Image Viewer, this list order dictates the arrangement of images according to the
            left-right and top-down pattern. If desired, rearranging the order is as straightforward as <code>drag-and-drop</code> action, allowing you to position images as per your preferences.
        </p>
    </div>
);
