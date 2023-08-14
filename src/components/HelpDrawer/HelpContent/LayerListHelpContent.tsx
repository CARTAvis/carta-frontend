import widgetButtonImageList from "static/help/widgetButton_imageList.png";
import widgetButtonImageList_d from "static/help/widgetButton_imageList_d.png";

import {ImageComponent} from "../ImageComponent";

export const LAYER_LIST_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={widgetButtonImageList} dark={widgetButtonImageList_d} width="90%" />
        </p>
        <p>
            The image list widget serves as a comprehensive display platform for all loaded images, showcasing essential information in a structured list format. Each entry includes the image name, rendering layers (designated as R for
            raster, C for contours, and V for vector field), layer visibility status, spatial matching state, spectral matching status, color range matching state, channel index, and polarization type. Notably, the channel index and
            polarization type are synchronized with the animator widget.
        </p>
        <p>For streamlined interaction, you can leverage designated buttons: clicking "R" toggles the visibility of raster layers, "C" manages the visibility of contour layers, and "V" controls the visibility of vector field layers.</p>
        <p>
            Per image, you retain the flexibility to manage spatial and spectral matching. By clicking the XY button, spatial matching can be enabled or disabled, while the Z button serves a similar purpose for spectral matching. To align
            the color range with the reference image, clicking the "R" button accomplishes this task.
        </p>
        <p>
            Should the need arise to change the reference image, a right-click on a row unveils a context menu. Through this menu, you can independently define the spatial reference image, spectral reference image, and raster scaling
            reference image. Additionally, spectral matching defaults to the radio velocity convention, but if alternative spectral conventions (such as frequency or channel) are desired, the Matching tab within the image list settings
            dialog (accessed via the cog icon at the widget's top-right corner) offers configuration options.
        </p>
        <p>
            When spectrally matching in the velocity domain, the ability to redefine the rest frequency for frequency-to-velocity conversion per image is noteworthy. This affords efficient comparison of distinct spectral features without
            the need for permanent alterations to the RESTFRQ header. You can engage this functionality either through right-clicking on a row or by utilizing the Rest Frequency tab in the image list settings dialog.
        </p>
        <p>Closing images is also seamless: a right-click on a row presents the context menu, or you can employ the "File" menu and select "Close Image."</p>
        <p>
            Furthermore, the sequence of entries in the list mirrors the order within the image slider of the animator. In the multi-panel view of the image viewer, this list order dictates the arrangement of images according to the
            left-right and top-down pattern. If desired, rearranging the order is as straightforward as drag-and-drop functionality, allowing you to effortlessly position images as per your preferences.
        </p>
    </div>
);
