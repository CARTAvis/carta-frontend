import * as React from "react";
import {ImageComponent} from "./ImageComponent";
import headFileinfoButton from "static/help/head_fileinfo_button.png";
import headFileinfoButton_d from "static/help/head_fileinfo_button_d.png";

export class FileInfoHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p><ImageComponent light={headFileinfoButton} dark={headFileinfoButton_d} width="90%"/></p>
                <p>File header dialogue provides full image header and a summary of the properties of the image in the current image view. To switch to other images, use the image slider in the animator widget, or use the image list
                    widget.</p>
                <p>Search function is available in the header tab. The search button shows up when hovering over the header context. Case-insensitive partial match is adopted.</p>
            </div>
        );
    }
}
