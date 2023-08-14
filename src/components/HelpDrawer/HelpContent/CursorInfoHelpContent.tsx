import wigetButtonCursorInfo from "static/help/widgetButton_cursorInfo.png";
import wigetButtonCursorInfo_d from "static/help/widgetButton_cursorInfo_d.png";

import {ImageComponent} from "../ImageComponent";

export const CURSOR_INFO_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={wigetButtonCursorInfo} dark={wigetButtonCursorInfo_d} width="90%" />
        </p>
        <p>
            The Cursor Information widget serves as a centralized hub for displaying cursor-related details across multiple images. Within this widget, the active image stands out distinctly, emphasized in boldface text style. In cases
            where the cursor is positioned over an unmatched image, the widget showcases the cursor information specific to that particular image. Alternatively, when the cursor resides over a matched image, the widget effectively presents
            the cursor information pertinent to all the matched images, each displayed correspondingly.
        </p>
        <p>The process of image matching can be conveniently configured through the image list widget. Within this interface, the XY button serves as an identifier for spatial matching, while the Z button signifies spectral matching.</p>
    </div>
);
