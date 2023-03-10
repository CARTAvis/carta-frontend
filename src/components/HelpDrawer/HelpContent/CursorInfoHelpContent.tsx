import wigetButtonCursorInfo from "static/help/widgetButton_cursorInfo.png";
import wigetButtonCursorInfo_d from "static/help/widgetButton_cursorInfo_d.png";

import {ImageComponent} from "../ImageComponent";

export const CURSOR_INFO_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={wigetButtonCursorInfo} dark={wigetButtonCursorInfo_d} width="90%" />
        </p>
        <p>
            The cursor information widget is a centralized place to show cursor information for multiple images. The active image is highlighted in boldface text style. If the cursor is on an unmatched image, the cursor information of the
            image is displayed. If the cursor is on a matched image, the cursor information of all the matched images is displayed respectively. Image matching can be set in the image list widget.
        </p>
    </div>
);
