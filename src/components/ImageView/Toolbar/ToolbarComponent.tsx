import * as React from "react";
import {CSSProperties} from "react";
import {observer} from "mobx-react";
import {AnchorButton, ButtonGroup, IconName, Menu, MenuItem, Popover, PopoverPosition, Position, Tooltip} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {AppStore, OverlayStore, RegionMode, SystemType} from "stores";
import {ImageViewLayer} from "../ImageViewComponent";
import {toFixed} from "utilities";
import "./ToolbarComponent.scss";

export class ToolbarComponentProps {
    docked: boolean;
    visible: boolean;
    vertical: boolean;
    onActiveLayerChange: (layer: ImageViewLayer) => void;
    activeLayer: ImageViewLayer;
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
        AppStore.Instance.activeFrame.setZoom(1.0);
    };

    handleZoomInClicked = () => {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame.spatialReference || appStore.activeFrame;
        frame.setZoom(frame.zoomLevel * 2.0, true);
    };

    handleZoomOutClicked = () => {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame.spatialReference || appStore.activeFrame;
        frame.setZoom(frame.zoomLevel / 2.0, true);
    };

    handleRegionTypeClicked = (type: CARTA.RegionType) => {
        const appStore = AppStore.Instance;
        appStore.activeFrame.regionSet.setNewRegionType(type);
        appStore.activeFrame.regionSet.setMode(RegionMode.CREATING);
    };

    handleCoordinateSystemClicked = (coordinateSystem: SystemType) => {
        OverlayStore.Instance.global.setSystem(coordinateSystem);
    };

    private handelActiveLayerClicked = (layer: ImageViewLayer) => {
        this.props.onActiveLayerChange(layer);
        if (layer === ImageViewLayer.RegionMoving) {
            AppStore.Instance.activeFrame.regionSet.setMode(RegionMode.MOVING);
        }
    }

    exportImageTooltip = () => {
        return (
            <span><br/><i><small>
                Background color is {AppStore.Instance.preferenceStore.transparentImageBackground ? "transparent" : "filled"}.<br/>
                {AppStore.Instance.preferenceStore.transparentImageBackground ? "Disable" : "Enable"} transparent image background in Preferences.<br/>
            </small></i></span>
        );
    };

    render() {
        const appStore = AppStore.Instance;
        const preferenceStore = appStore.preferenceStore;
        const overlay = appStore.overlayStore;
        const frame = appStore.activeFrame;
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

        let coordinateSystem = overlay.global.system;

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

        const spatialMatchingEnabled = !!frame.spatialReference;
        const spectralMatchingEnabled = !!frame.spectralReference;
        const canEnableSpatialMatching = appStore.spatialReference !== frame;
        const canEnableSpectralMatching = appStore.spectralReference && appStore.spectralReference !== frame && frame.frameInfo.fileInfoExtended.depth > 1;
        const wcsButtonSuperscript = (spatialMatchingEnabled ? "x" : "") + (spectralMatchingEnabled ? "z" : "");
        const wcsButtonTooltipEntries = [];
        if (spectralMatchingEnabled) {
            wcsButtonTooltipEntries.push(`Spectral (${preferenceStore.spectralMatchingType})`);
        }
        if (spatialMatchingEnabled) {
            wcsButtonTooltipEntries.push("Spatial");
        }
        const wcsButtonTooltip = wcsButtonTooltipEntries.join(" and ") || "None";

        const wcsMatchingMenu = (
            <Menu>
                <MenuItem
                    text={`Spectral (${preferenceStore.spectralMatchingType}) and Spatial`}
                    disabled={!canEnableSpatialMatching || !canEnableSpectralMatching}
                    active={spectralMatchingEnabled && spatialMatchingEnabled}
                    onClick={() => appStore.setMatchingEnabled(true, true)}
                />
                <MenuItem
                    text={`Spectral (${preferenceStore.spectralMatchingType})  only`}
                    disabled={!canEnableSpectralMatching}
                    active={spectralMatchingEnabled && !spatialMatchingEnabled}
                    onClick={() => appStore.setMatchingEnabled(false, true)}
                />
                <MenuItem
                    text="Spatial only"
                    disabled={!canEnableSpatialMatching}
                    active={!spectralMatchingEnabled && spatialMatchingEnabled}
                    onClick={() => appStore.setMatchingEnabled(true, false)}
                />
                <MenuItem
                    text="None"
                    disabled={!canEnableSpatialMatching}
                    active={!spectralMatchingEnabled && !spatialMatchingEnabled}
                    onClick={() => appStore.setMatchingEnabled(false, false)}
                />
            </Menu>
        );

        const catalogOverlayEnabled = appStore.activeLayer === ImageViewLayer.Catalog;
        const catalogSelectionDisabled = appStore.catalogNum === 0;

        return (
            <ButtonGroup className={className} style={styleProps} vertical={this.props.vertical}>
                <Tooltip position={tooltipPosition} content={<span>Catalog selection<br/><i><small>Click to select single catalog source</small></i></span>}>
                    <AnchorButton icon={"locate"} active={catalogOverlayEnabled} onClick={() => this.handelActiveLayerClicked(ImageViewLayer.Catalog)} disabled={catalogSelectionDisabled}/>
                </Tooltip>
                {frame.regionSet.mode === RegionMode.CREATING &&
                <Tooltip position={tooltipPosition} content={<span>Create region<br/><i><small>Click to select region type</small></i></span>}>
                    <Popover content={regionMenu} position={Position.TOP} minimal={true}>
                        <AnchorButton icon={regionIcon} active={!catalogOverlayEnabled} onClick={() => this.handelActiveLayerClicked(ImageViewLayer.RegionCreating)}/>
                    </Popover>
                </Tooltip>
                }
                {frame.regionSet.mode === RegionMode.MOVING &&
                <Tooltip position={tooltipPosition} content={<span>Create region<br/><i><small>Double-click to select region type.<br/>Press C to enter creation mode.</small></i></span>}>
                    <AnchorButton icon={regionIcon} onClick={() => frame.regionSet.setMode(RegionMode.CREATING)}/>
                </Tooltip>
                }
                <Tooltip position={tooltipPosition} content="Select and pan mode">
                    <AnchorButton icon={"hand"} onClick={() => this.handelActiveLayerClicked(ImageViewLayer.RegionMoving)} active={frame.regionSet.mode === RegionMode.MOVING && !catalogOverlayEnabled}/>
                </Tooltip>
                <Tooltip position={tooltipPosition} content={<span>Zoom in (Scroll wheel up){currentZoomSpan}</span>}>
                    <AnchorButton icon={"zoom-in"} onClick={this.handleZoomInClicked}/>
                </Tooltip>
                <Tooltip position={tooltipPosition} content={<span>Zoom out (Scroll wheel down){currentZoomSpan}</span>}>
                    <AnchorButton icon={"zoom-out"} onClick={this.handleZoomOutClicked}/>
                </Tooltip>
                <Tooltip position={tooltipPosition} content={<span>Zoom to 1.0x{currentZoomSpan}</span>}>
                    <AnchorButton className={"full-zoom-button"} onClick={this.handleZoomToActualSizeClicked}>1.0x</AnchorButton>
                </Tooltip>
                <Tooltip position={tooltipPosition} content={<span>Zoom to fit{currentZoomSpan}</span>}>
                    <AnchorButton icon="zoom-to-fit" onClick={frame.fitZoom}/>
                </Tooltip>
                <Tooltip position={tooltipPosition} content={<span>WCS Matching <br/><small><i>Current: {wcsButtonTooltip}</i></small></span>}>
                    <Popover content={wcsMatchingMenu} position={Position.TOP} minimal={true}>
                        <AnchorButton icon="link" className="link-button">
                            {wcsButtonSuperscript}
                        </AnchorButton>
                    </Popover>
                </Tooltip>
                <Tooltip position={tooltipPosition} content={<span>Overlay Coordinate <br/><small><i>Current: {ToolbarComponent.CoordinateSystemTooltip.get(coordinateSystem)}</i></small></span>}>
                    <Popover content={coordinateSystemMenu} position={Position.TOP} minimal={true}>
                        <AnchorButton disabled={!frame.validWcs} text={ToolbarComponent.CoordinateSystemName.get(coordinateSystem)}/>
                    </Popover>
                </Tooltip>
                <Tooltip position={tooltipPosition} content="Toggle grid">
                    <AnchorButton icon="grid" active={grid.visible} onClick={() => grid.setVisible(!grid.visible)}/>
                </Tooltip>
                <Tooltip position={tooltipPosition} content="Toggle labels">
                    <AnchorButton icon="numerical" active={!overlay.labelsHidden} onClick={overlay.toggleLabels}/>
                </Tooltip>
                <Tooltip position={tooltipPosition} content={<span>{`Export image (${appStore.modifierString}E)`}{this.exportImageTooltip()}</span>}>
                    <AnchorButton icon="floppy-disk" onClick={appStore.exportImage}/>
                </Tooltip>
            </ButtonGroup>
        );
    }
}
