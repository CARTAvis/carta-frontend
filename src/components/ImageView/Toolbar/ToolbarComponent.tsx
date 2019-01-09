import * as React from "react";
import {CSSProperties} from "react";
import {observer} from "mobx-react";
import {Button, ButtonGroup, PopoverPosition, Tooltip} from "@blueprintjs/core";
import {exportImage} from "components";
import {AppStore} from "stores";
import "./ToolbarComponent.css";

export class ToolbarComponentProps {
    appStore: AppStore;
    docked: boolean;
    visible: boolean;
    vertical: boolean;
}

@observer
export class ToolbarComponent extends React.Component<ToolbarComponentProps> {

    handleZoomToActualSizeClicked = () => {
        this.props.appStore.activeFrame.setZoom(1.0);
    };

    handleZoomInClicked = () => {
        this.props.appStore.activeFrame.setZoom(this.props.appStore.activeFrame.zoomLevel * 2.0);
    };

    handleZoomOutClicked = () => {
        this.props.appStore.activeFrame.setZoom(this.props.appStore.activeFrame.zoomLevel / 2.0);
    };

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

        const currentZoomSpan = <span><br/><i><small>Current: {frame.zoomLevel.toFixed(2)}x</small></i></span>;
        const tooltipPosition: PopoverPosition = this.props.vertical ? "left" : "auto";
        return (
            <ButtonGroup className={className} style={styleProps} vertical={this.props.vertical}>
                <Tooltip position={tooltipPosition} content={<span>Zoom in (Scroll wheel up){currentZoomSpan}</span>}>
                    <Button icon={"zoom-in"} onClick={this.handleZoomInClicked}/>
                </Tooltip>
                <Tooltip position={tooltipPosition} content={<span>Zoom out (Scroll wheel down){currentZoomSpan}</span>}>
                    <Button icon={"zoom-out"} onClick={this.handleZoomOutClicked}/>
                </Tooltip>
                <Tooltip position={tooltipPosition} content={<span>Zoom to 1.0x{currentZoomSpan}</span>}>
                    <Button className={"full-zoom-button"} onClick={this.handleZoomToActualSizeClicked}>1.0x</Button>
                </Tooltip>
                <Tooltip position={tooltipPosition} content={<span>Zoom to fit{currentZoomSpan}</span>}>
                    <Button icon="zoom-to-fit" onClick={frame.fitZoom}/>
                </Tooltip>
                <Tooltip position={tooltipPosition} content="Toggle grid">
                    <Button icon="grid" active={grid.visible} onClick={() => grid.setVisible(!grid.visible)}/>
                </Tooltip>
                <Tooltip position={tooltipPosition} content="Toggle labels">
                    <Button icon="numerical" active={!overlay.labelsHidden} onClick={overlay.toggleLabels}/>
                </Tooltip>
                <Tooltip position={tooltipPosition} content={`Export image (${appStore.modifierString}E)`}>
                    <Button icon="floppy-disk" onClick={() => exportImage(overlay.padding, appStore.darkTheme, appStore.activeFrame.frameInfo.fileInfo.name)}/>
                </Tooltip>
            </ButtonGroup>
        );
    }
}
