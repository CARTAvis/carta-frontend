import wigetButtonCursorInfo from "static/help/widgetButton_cursorInfo.png";
import wigetButtonCursorInfo_d from "static/help/widgetButton_cursorInfo_d.png";

import {ImageComponent} from "../ImageComponent";

export const CURSOR_INFO_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={wigetButtonCursorInfo} dark={wigetButtonCursorInfo_d} width="90%" />
        </p>
        <p>
            The Cursor Information Widget is a centralized location for displaying cursor information across multiple images. Information for the active image is highlighted in boldface text. If the cursor is positioned over an unmatched
            image, the widget only displays the cursor information for that single image. If the cursor is positioned over a matched image, the widget presents the cursor information for all the matched images, each in a separate row.
        </p>
        <p>
            Image matching can be configured through the Image List Widget or through the <b>WCS matching</b> button in the toolbar of the Image Viewer. In the Image List Widget, the <b>XY</b> button toggles spatial matching, while the{" "}
            <b>Z</b> button toggles spectral matching.
        </p>
    </div>
);
