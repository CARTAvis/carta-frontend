import {ImageComponent} from "../ImageComponent";
import wigetButtonCursorInfo from "static/help/widgetButton_cursorInfo.png";
import wigetButtonCursorInfo_d from "static/help/widgetButton_cursorInfo_d.png";


export const CURSOR_INFO_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={wigetButtonCursorInfo} dark={wigetButtonCursorInfo_d} width="90%" />
        </p>
    </div>
);
