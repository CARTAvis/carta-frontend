import * as React from "react";
import {CSSProperties} from "react";
import {observer} from "mobx-react";
import {Button, ButtonGroup, IconName, Menu, MenuItem, Popover, PopoverPosition, Position, Tooltip} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {exportImage} from "components";
import {AppStore, RegionMode} from "stores";
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

    handleRegionTypeClicked = (type: CARTA.RegionType) => {
        this.props.appStore.activeFrame.regionSet.setNewRegionType(type);
        this.props.appStore.activeFrame.regionSet.setMode(RegionMode.CREATING);
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
        const tooltipPosition: PopoverPosition = this.props.vertical ? "left" : "bottom";

        const regionMenu = (
            <Menu>
                <MenuItem icon={"square"} text="Rectangle" onClick={() => this.handleRegionTypeClicked(CARTA.RegionType.RECTANGLE)}/>
                <MenuItem icon={"circle"} text="Ellipse" onClick={() => this.handleRegionTypeClicked(CARTA.RegionType.ELLIPSE)}/>
                <MenuItem disabled={true} icon={"polygon-filter"} text="Polygon"/>
            </Menu>
        );

        let regionIcon: IconName;
        switch (frame.regionSet.newRegionType) {
            case CARTA.RegionType.RECTANGLE:
                regionIcon = "square";
                break;
            case CARTA.RegionType.ELLIPSE:
                regionIcon = "circle";
                break;
            default:
                regionIcon = "error";
        }

        return (
            <ButtonGroup className={className} style={styleProps} vertical={this.props.vertical}>

                {frame.regionSet.mode === RegionMode.CREATING &&
                <Tooltip position={tooltipPosition} content={<span>Create region<br/><i><small>Click to select region type</small></i></span>}>
                    <Popover content={regionMenu} position={Position.TOP} minimal={true}>
                        <Button icon={regionIcon} active={true}/>
                    </Popover>
                </Tooltip>
                }
                {frame.regionSet.mode === RegionMode.MOVING &&
                <Tooltip position={tooltipPosition} content={<span>Create region<br/><i><small>Double-click to select region type</small></i></span>}>
                    <Button icon={regionIcon} onClick={() => this.props.appStore.activeFrame.regionSet.setMode(RegionMode.CREATING)}/>
                </Tooltip>
                }
                <Tooltip position={tooltipPosition} content="Select and pan mode">
                    <Button icon={"hand"} onClick={() => frame.regionSet.setMode(RegionMode.MOVING)} active={frame.regionSet.mode === RegionMode.MOVING}/>
                </Tooltip>
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
