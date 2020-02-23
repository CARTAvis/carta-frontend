import * as React from "react";
import {CSSProperties} from "react";
import {observer} from "mobx-react";
import {AnchorButton, Button, ButtonGroup, IconName, Menu, MenuItem, Popover, PopoverPosition, Position, Tooltip} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {exportImage} from "components";
import {AppStore, RegionMode, SystemType} from "stores";
import {toFixed} from "utilities";
import "./ToolbarComponent.css";

export class ToolbarComponentProps {
    appStore: AppStore;
    docked: boolean;
    visible: boolean;
    vertical: boolean;
}

@observer
export class ToolbarComponent extends React.Component<ToolbarComponentProps> {
    private static readonly CoordinateSystemName = new Map<SystemType, string>([
        [SystemType.Auto, "WCS"],
        [SystemType.FK5, "FK5"],
        [SystemType.FK4, "FK4"],
        [SystemType.Galactic, "GAL"],
        [SystemType.Ecliptic, "ECL"],
        [SystemType.ICRS, "ICRS"],
    ]);

    private static readonly CoordinateSystemTooltip = new Map<SystemType, string>([
        [SystemType.Auto, "Automatically select the coordinate system based on file headers"],
        [SystemType.FK5, "FK5 coordinates, J2000.0 equinox"],
        [SystemType.FK4, "FK4 coordinates, B1950.0 equinox"],
        [SystemType.Galactic, "Galactic coordinates"],
        [SystemType.Ecliptic, "Ecliptic coordinates"],
        [SystemType.ICRS, "International Celestial Reference System"],
    ]);

    handleZoomToActualSizeClicked = () => {
        this.props.appStore.activeFrame.setZoom(1.0);
    };

    handleZoomInClicked = () => {
        const frame = this.props.appStore.activeFrame.spatialReference || this.props.appStore.activeFrame;
        frame.setZoom(frame.zoomLevel * 2.0, true);
    };

    handleZoomOutClicked = () => {
        const frame = this.props.appStore.activeFrame.spatialReference || this.props.appStore.activeFrame;
        frame.setZoom(frame.zoomLevel / 2.0, true);
    };

    handleRegionTypeClicked = (type: CARTA.RegionType) => {
        this.props.appStore.activeFrame.regionSet.setNewRegionType(type);
        this.props.appStore.activeFrame.regionSet.setMode(RegionMode.CREATING);
    };

    handleCoordinateSystemClicked = (coordinateSystem: SystemType) => {
        this.props.appStore.overlayStore.global.setSystem(coordinateSystem);
    };

    handleSpatialReferenceToggled = () => {
        this.props.appStore.toggleSpatialMatching(this.props.appStore.activeFrame);
    };

    handleSpectralReferenceToggled = () => {
        this.props.appStore.toggleSpectralMatching(this.props.appStore.activeFrame);
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

        const zoomLevel = (frame.spatialReference && frame.spatialTransform) ? frame.spatialReference.zoomLevel * frame.spatialTransform.scale : frame.zoomLevel;
        const currentZoomSpan = <span><br/><i><small>Current: {toFixed(zoomLevel, 2)}x</small></i></span>;
        const tooltipPosition: PopoverPosition = this.props.vertical ? "left" : "bottom";

        const regionMenu = (
            <Menu>
                <MenuItem icon={"symbol-square"} text="Point" onClick={() => this.handleRegionTypeClicked(CARTA.RegionType.POINT)}/>
                <MenuItem icon={"square"} text="Rectangle" onClick={() => this.handleRegionTypeClicked(CARTA.RegionType.RECTANGLE)}/>
                <MenuItem icon={"circle"} text="Ellipse" onClick={() => this.handleRegionTypeClicked(CARTA.RegionType.ELLIPSE)}/>
                <MenuItem icon={"polygon-filter"} text="Polygon" onClick={() => this.handleRegionTypeClicked(CARTA.RegionType.POLYGON)}/>
            </Menu>
        );

        let coordinateSystem = this.props.appStore.overlayStore.global.system;

        const coordinateSystemMenu = (
            <Menu>
                <MenuItem text={ToolbarComponent.CoordinateSystemName.get(SystemType.Auto)} onClick={() => this.handleCoordinateSystemClicked(SystemType.Auto)}/>
                <MenuItem text={ToolbarComponent.CoordinateSystemName.get(SystemType.FK5)} onClick={() => this.handleCoordinateSystemClicked(SystemType.FK5)}/>
                <MenuItem text={ToolbarComponent.CoordinateSystemName.get(SystemType.FK4)} onClick={() => this.handleCoordinateSystemClicked(SystemType.FK4)}/>
                <MenuItem text={ToolbarComponent.CoordinateSystemName.get(SystemType.Galactic)} onClick={() => this.handleCoordinateSystemClicked(SystemType.Galactic)}/>
                <MenuItem text={ToolbarComponent.CoordinateSystemName.get(SystemType.Ecliptic)} onClick={() => this.handleCoordinateSystemClicked(SystemType.Ecliptic)}/>
                <MenuItem text={ToolbarComponent.CoordinateSystemName.get(SystemType.ICRS)} onClick={() => this.handleCoordinateSystemClicked(SystemType.ICRS)}/>
            </Menu>
        );

        let regionIcon: IconName;
        switch (frame.regionSet.newRegionType) {
            case CARTA.RegionType.POINT:
                regionIcon = "symbol-square";
                break;
            case CARTA.RegionType.RECTANGLE:
                regionIcon = "square";
                break;
            case CARTA.RegionType.ELLIPSE:
                regionIcon = "circle";
                break;
            case CARTA.RegionType.POLYGON:
                regionIcon = "polygon-filter";
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
                <Tooltip position={tooltipPosition} content={<span>Toggle spatial matching</span>}>
                    <AnchorButton className={"link-button"} icon="link" disabled={appStore.spatialReference === frame} active={!!frame.spatialReference} onClick={this.handleSpatialReferenceToggled}>
                        xy
                    </AnchorButton>
                </Tooltip>
                <Tooltip position={tooltipPosition} content={<span>Toggle spectral matching</span>}>
                    <AnchorButton
                        className={"link-button"}
                        icon="link"
                        disabled={!appStore.spectralReference || appStore.spectralReference === frame || frame.frameInfo.fileInfoExtended.depth <= 1}
                        active={!!frame.spectralReference}
                        onClick={this.handleSpectralReferenceToggled}
                    >
                        &nbsp;z
                    </AnchorButton>
                </Tooltip>
                <Tooltip position={tooltipPosition} content={<span>Overlay Coordinate <br/><small><i>Current: {ToolbarComponent.CoordinateSystemTooltip.get(coordinateSystem)}</i></small></span>}>
                    <Popover content={coordinateSystemMenu} position={Position.TOP} minimal={true}>
                        <Button text={ToolbarComponent.CoordinateSystemName.get(coordinateSystem)}/>
                    </Popover>
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
