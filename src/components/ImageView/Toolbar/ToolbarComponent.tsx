import * as React from "react";
import {observer} from "mobx-react";
import "./ToolbarComponent.css";
import {Button, ButtonGroup} from "@blueprintjs/core";
import {OverlayStore} from "../../../stores/OverlayStore";
import {FrameStore} from "../../../stores/FrameStore";
import {exportImage} from "../ImageViewComponent";

export class ToolbarComponentProps {
    overlaySettings: OverlayStore;
    frame: FrameStore;
}

@observer
export class ToolbarComponent extends React.Component<ToolbarComponentProps> {

    render() {
        const frame = this.props.frame;
        const grid = this.props.overlaySettings.grid;
        const numbers = this.props.overlaySettings.numbers;
        
        return (
            <ButtonGroup minimal={true} className="image-toolbar">
                <Button icon="zoom-to-fit" onClick={() => frame.fitZoom()} />
                <Button icon="arrows-horizontal" onClick={() => frame.fitZoomX()} />
                <Button icon="arrows-vertical" onClick={() => frame.fitZoomY()} />
                <Button icon="grid" active={grid.visible} onClick={() => grid.setVisible(!grid.visible)} />
                <Button icon="numerical" active={numbers.visible} onClick={() => numbers.setVisible(!numbers.visible)} />
                <Button icon="floppy-disk" onClick={() => exportImage()} />
            </ButtonGroup>
        );
    }
}

// - Zoom to fit (using icon "zoom-to-fit" or to be consistent with below, "maximize")
// - Fit Horizontal (using icon "arrows-horizontal")
// - Fit Vertical (using icon "arrows-vertical")
// - Toggle grid (can be a togglable button, using icon "grid")
// - Toggle labels (can also be a toggleable button, using icon "numerical")
// - Save image (using icon "floppy-disk") (edited)
