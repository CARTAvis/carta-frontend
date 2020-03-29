import * as React from "react";
import {AppStore} from "stores";
import {ImageComponent} from "./ImageComponent";
import * as headFileinfoButton from "static/help/head_fileinfo_button.png";
import * as headFileinfoButton_d from "static/help/head_fileinfo_button_d.png";

export class FileInfoHelpComponent extends React.Component<{ appStore: AppStore }> {
    public render() {
        const appStore = this.props.appStore;
        return (
            <div>
                <p><ImageComponent appStore={appStore} light={headFileinfoButton} dark={headFileinfoButton_d} width="90%"/></p>
                <p>File information dialogue provides a summary of the properties and the full image header of the image in the current
        image viewer. To switch to other images, use the frame slider in the animator widget.</p>
            </div>
        );
    }
}
