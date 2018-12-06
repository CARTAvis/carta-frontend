import * as React from "react";
import {CSSProperties} from "react";
import {observer} from "mobx-react";
import "./ToolbarComponent.css";
import {Button, ButtonGroup, Tooltip} from "@blueprintjs/core";
import {AppStore} from "../../../stores/AppStore";
import {exportImage} from "../ImageViewComponent";

export class ToolbarComponentProps {
    appStore: AppStore;
    docked: boolean;
    visible: boolean;
}

@observer
export class ToolbarComponent extends React.Component<ToolbarComponentProps> {

    render() {
        const appStore = this.props.appStore;
        const frame = appStore.activeFrame;
        const overlay = appStore.overlayStore;
        const grid = overlay.grid;

        let styleProps: CSSProperties = {
            bottom: overlay.padding.bottom,
            right: overlay.padding.right,
            opacity: this.props.visible ? 1 : 0
        };

        let className = "image-toolbar";

        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

        if (this.props.docked) {
            className += " docked";
        }

        return (
            <ButtonGroup className={className} style={styleProps}>
                <Tooltip content="Fit width">
                    <Button icon="arrows-horizontal" onClick={frame.fitZoomX}/>
                </Tooltip>
                <Tooltip content="Fit height">
                    <Button icon="arrows-vertical" onClick={frame.fitZoomY}/>
                </Tooltip>
                <Tooltip content="Toggle grid">
                    <Button icon="grid" active={grid.visible} onClick={() => grid.setVisible(!grid.visible)}/>
                </Tooltip>
                <Tooltip content="Toggle labels">
                    <Button icon="numerical" active={!overlay.labelsHidden} onClick={overlay.toggleLabels}/>
                </Tooltip>
                <Tooltip content="Export image">
                    <Button icon="floppy-disk" onClick={() => exportImage(overlay.padding, appStore.darkTheme)}/>
                </Tooltip>
            </ButtonGroup>
        );
    }
}