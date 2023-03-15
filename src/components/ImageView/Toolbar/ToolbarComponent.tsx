import * as React from "react";
import {CSSProperties} from "react";
import {AnchorButton, ButtonGroup, IconName, Menu, MenuItem, PopoverPosition, Position} from "@blueprintjs/core";
import {Popover2, Tooltip2} from "@blueprintjs/popover2";
import {CARTA} from "carta-protobuf";
import classNames from "classnames";
import {observer} from "mobx-react";

import {ImageViewComponent, ImageViewLayer} from "components";
import {ExportImageMenuComponent} from "components/Shared";
import {CustomIcon, CustomIconName} from "icons/CustomIcons";
import {AppStore} from "stores";
import {FrameStore, RegionMode, RegionStore} from "stores/Frame";
import {OverlayStore, SystemType} from "stores/OverlayStore/OverlayStore";
import {toFixed} from "utilities";

import "./ToolbarComponent.scss";

export class ToolbarComponentProps {
    docked: boolean;
    visible: boolean;
    frame: FrameStore;
    activeLayer: ImageViewLayer;
    onActiveLayerChange: (layer: ImageViewLayer) => void;
    onRegionViewZoom: (zoom: number) => void;
    onZoomToFit: () => void;
}

@observer
export class ToolbarComponent extends React.Component<ToolbarComponentProps> {
    private static readonly CoordinateSystemName = new Map<SystemType, string>([
        [SystemType.Auto, "WCS"],
        [SystemType.FK5, "FK5"],
        [SystemType.FK4, "FK4"],
        [SystemType.Galactic, "GAL"],
        [SystemType.Ecliptic, "ECL"],
        [SystemType.ICRS, "ICRS"]
    ]);

    private static readonly CoordinateSystemTooltip = new Map<SystemType, string>([
        [SystemType.Auto, "Automatically select the coordinate system based on file headers"],
        [SystemType.FK5, "FK5 coordinates, J2000.0 equinox"],
        [SystemType.FK4, "FK4 coordinates, B1950.0 equinox"],
        [SystemType.Galactic, "Galactic coordinates"],
        [SystemType.Ecliptic, "Ecliptic coordinates"],
        [SystemType.ICRS, "International Celestial Reference System"]
    ]);

    handleZoomToActualSizeClicked = () => {
        const zoom = 1.0;
        this.props.frame.setZoom(zoom);
        this.props.onRegionViewZoom(zoom);
    };

    handleZoomInClicked = () => {
        const frame = this.props.frame.spatialReference || this.props.frame;
        const zoom = frame.zoomLevel * 2.0;
        frame.setZoom(zoom, true);
        this.props.onRegionViewZoom(zoom);
    };

    handleZoomOutClicked = () => {
        const frame = this.props.frame.spatialReference || this.props.frame;
        const zoom = frame.zoomLevel / 2.0;
        frame.setZoom(zoom, true);
        this.props.onRegionViewZoom(zoom);
    };

    handleRegionTypeClicked = (type: CARTA.RegionType) => {
        this.props.frame.regionSet.setNewRegionType(type);
        this.props.frame.regionSet.setMode(RegionMode.CREATING);
    };

    handleCoordinateSystemClicked = (coordinateSystem: SystemType) => {
        OverlayStore.Instance.global.setSystem(coordinateSystem);
    };

    private handleActiveLayerClicked = (layer: ImageViewLayer) => {
        const appStore = AppStore.Instance;
        if (appStore.activeLayer !== ImageViewLayer.DistanceMeasuring && layer === ImageViewLayer.DistanceMeasuring) {
            appStore.frames.forEach(frame => frame.distanceMeasuring.resetPos());
        }
        this.props.onActiveLayerChange(layer);
        if (layer === ImageViewLayer.RegionCreating) {
            this.props.frame.regionSet.setMode(RegionMode.CREATING);
        } else {
            this.props.frame.regionSet.setMode(RegionMode.MOVING);
        }
    };

    private handlePanZoomShortCutClicked = () => {
        const widgetsStore = AppStore.Instance.widgetsStore;
        const parentType = ImageViewComponent.WIDGET_CONFIG.type;
        const settingsWidget = widgetsStore.floatingWidgets?.find(w => w.parentType === parentType);
        if (settingsWidget) {
            widgetsStore.removeFloatingWidget(settingsWidget.id);
        }
        // delay to wait for the settings widget tab status to reset
        setTimeout(() => {
            widgetsStore.createFloatingSettingsWidget("Image View", parentType, parentType);
        }, 0);
    };

    exportImageTooltip = () => {
        return (
            <span>
                <br />
                <i>
                    <small>
                        Background color is {AppStore.Instance.preferenceStore.transparentImageBackground ? "transparent" : "filled"}.<br />
                        {AppStore.Instance.preferenceStore.transparentImageBackground ? "Disable" : "Enable"} transparent image background in Preferences.
                        <br />
                    </small>
                </i>
            </span>
        );
    };

    render() {
        const appStore = AppStore.Instance;
        const preferenceStore = appStore.preferenceStore;
        const overlay = appStore.overlayStore;
        const dialogStore = appStore.dialogStore;
        const frame = this.props.frame;
        const grid = overlay.grid;

        const styleProps: CSSProperties = {
            bottom: overlay.padding.bottom,
            right: overlay.padding.right,
            left: overlay.padding.left,
            opacity: this.props.visible ? 1 : 0,
            backgroundColor: "transparent"
        };

        const className = classNames("image-toolbar", {docked: this.props.docked, "bp3-dark": appStore.darkTheme});

        const zoomLevel = frame.spatialReference && frame.spatialTransform ? frame.spatialReference.zoomLevel * frame.spatialTransform.scale : frame.zoomLevel;
        const currentZoomSpan = (
            <span>
                <br />
                <i>
                    <small>Current: {toFixed(zoomLevel, 2)}x</small>
                </i>
            </span>
        );
        const tooltipPosition: PopoverPosition = "top";

        const regionMenu = (
            <Menu>
                {Array.from(RegionStore.AVAILABLE_REGION_TYPES).map(([type, text], index) => {
                    const regionIconString: IconName | CustomIconName = RegionStore.RegionIconString(type);
                    const regionIcon = RegionStore.IsRegionCustomIcon(type) ? <CustomIcon icon={regionIconString as CustomIconName} /> : (regionIconString as IconName);
                    return <MenuItem icon={regionIcon} text={text} onClick={() => this.handleRegionTypeClicked(type)} key={index} />;
                })}
            </Menu>
        );

        let coordinateSystem = overlay.global.system;

        const coordinateSystemMenu = (
            <Menu>
                <MenuItem text={ToolbarComponent.CoordinateSystemName.get(SystemType.Auto)} onClick={() => this.handleCoordinateSystemClicked(SystemType.Auto)} />
                <MenuItem text={ToolbarComponent.CoordinateSystemName.get(SystemType.FK5)} onClick={() => this.handleCoordinateSystemClicked(SystemType.FK5)} />
                <MenuItem text={ToolbarComponent.CoordinateSystemName.get(SystemType.FK4)} onClick={() => this.handleCoordinateSystemClicked(SystemType.FK4)} />
                <MenuItem text={ToolbarComponent.CoordinateSystemName.get(SystemType.Galactic)} onClick={() => this.handleCoordinateSystemClicked(SystemType.Galactic)} />
                <MenuItem text={ToolbarComponent.CoordinateSystemName.get(SystemType.Ecliptic)} onClick={() => this.handleCoordinateSystemClicked(SystemType.Ecliptic)} />
                <MenuItem text={ToolbarComponent.CoordinateSystemName.get(SystemType.ICRS)} onClick={() => this.handleCoordinateSystemClicked(SystemType.ICRS)} />
            </Menu>
        );

        const regionIconString: IconName | CustomIconName = RegionStore.RegionIconString(frame.regionSet.newRegionType);
        const regionIcon = RegionStore.IsRegionCustomIcon(frame.regionSet.newRegionType) ? <CustomIcon icon={regionIconString as CustomIconName} /> : (regionIconString as IconName);

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
                    text={`Spectral (${preferenceStore.spectralMatchingType}) and spatial`}
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
                <MenuItem text="Spatial only" disabled={!canEnableSpatialMatching} active={!spectralMatchingEnabled && spatialMatchingEnabled} onClick={() => appStore.setMatchingEnabled(true, false)} />
                <MenuItem text="None" disabled={!canEnableSpatialMatching} active={!spectralMatchingEnabled && !spatialMatchingEnabled} onClick={() => appStore.setMatchingEnabled(false, false)} />
            </Menu>
        );

        const exportImageMenu = (
            <Menu>
                <ExportImageMenuComponent />
            </Menu>
        );

        const baseFrame = this.props.frame;
        const numSourcesArray = appStore.catalogStore.visibleCatalogFiles.get(baseFrame)?.map(fileId => appStore.catalogStore.catalogCounts.get(fileId));
        const numSourcesIsZero = numSourcesArray?.every(element => element === 0);

        const catalogOverlayEnabled = appStore.activeLayer === ImageViewLayer.Catalog;
        const catalogSelectionDisabled = appStore.catalogNum === 0 || numSourcesIsZero === true;

        const handleDistanceMeasuringClicked = () => {
            this.handleActiveLayerClicked(ImageViewLayer.DistanceMeasuring);
        };

        return (
            <ButtonGroup className={className} style={styleProps}>
                {appStore.toolbarExpanded && (
                    <React.Fragment>
                        {!frame.isPreview && (
                            <>
                                <Tooltip2
                                    position={tooltipPosition}
                                    content={
                                        <span>
                                            Distance measurement
                                            <br />
                                            <i>
                                                <small>Click to create geodesic curves.</small>
                                                <br></br>
                                                <small>Double Click to open the settings.</small>
                                            </i>
                                        </span>
                                    }
                                >
                                    <AnchorButton
                                        icon={<CustomIcon icon="distanceMeasuring" />}
                                        active={appStore.activeLayer === ImageViewLayer.DistanceMeasuring}
                                        onClick={handleDistanceMeasuringClicked}
                                        onDoubleClick={dialogStore.showDistanceMeasuringDialog}
                                    />
                                </Tooltip2>
                                <Tooltip2
                                    position={tooltipPosition}
                                    content={
                                        <span>
                                            Catalog selection
                                            <br />
                                            <i>
                                                <small>Click to select single catalog source</small>
                                            </i>
                                        </span>
                                    }
                                >
                                    <AnchorButton icon={"locate"} active={catalogOverlayEnabled} onClick={() => this.handleActiveLayerClicked(ImageViewLayer.Catalog)} disabled={catalogSelectionDisabled} />
                                </Tooltip2>
                                {frame.regionSet.mode === RegionMode.CREATING && (
                                    <Popover2 popoverClassName="region-menu" content={regionMenu} position={Position.TOP} minimal={true}>
                                        <Tooltip2
                                            position={tooltipPosition}
                                            content={
                                                <span>
                                                    Create region
                                                    <br />
                                                    <i>
                                                        <small>Click to select region type</small>
                                                    </i>
                                                </span>
                                            }
                                        >
                                            <AnchorButton icon={regionIcon} active={appStore.activeLayer === ImageViewLayer.RegionCreating} onClick={() => this.handleActiveLayerClicked(ImageViewLayer.RegionCreating)} />
                                        </Tooltip2>
                                    </Popover2>
                                )}
                                {frame.regionSet.mode === RegionMode.MOVING && (
                                    <Tooltip2
                                        position={tooltipPosition}
                                        content={
                                            <span>
                                                Create region
                                                <br />
                                                <i>
                                                    <small>
                                                        Double-click to select region type.
                                                        <br />
                                                        Press C to enter creation mode.
                                                    </small>
                                                </i>
                                            </span>
                                        }
                                    >
                                        <AnchorButton icon={regionIcon} onClick={() => this.handleActiveLayerClicked(ImageViewLayer.RegionCreating)} />
                                    </Tooltip2>
                                )}
                                <Tooltip2
                                    position={tooltipPosition}
                                    content={
                                        <span>
                                            Select and pan mode
                                            <span>
                                                <br />
                                                <i>
                                                    <small>Double Click to open the settings.</small>
                                                </i>
                                            </span>
                                        </span>
                                    }
                                >
                                    <AnchorButton
                                        icon={"hand"}
                                        onClick={() => this.handleActiveLayerClicked(ImageViewLayer.RegionMoving)}
                                        onDoubleClick={this.handlePanZoomShortCutClicked}
                                        active={frame.regionSet.mode === RegionMode.MOVING && appStore.activeLayer === ImageViewLayer.RegionMoving}
                                    />
                                </Tooltip2>
                            </>
                        )}
                        <Tooltip2 position={tooltipPosition} content={<span>Zoom in (scroll wheel up){currentZoomSpan}</span>}>
                            <AnchorButton icon={"zoom-in"} onClick={this.handleZoomInClicked} />
                        </Tooltip2>
                        <Tooltip2 position={tooltipPosition} content={<span>Zoom out (scroll wheel down){currentZoomSpan}</span>}>
                            <AnchorButton icon={"zoom-out"} onClick={this.handleZoomOutClicked} />
                        </Tooltip2>
                        {!frame.isPreview && (
                            <Tooltip2 position={tooltipPosition} content={<span>Zoom to 1.0x{currentZoomSpan}</span>}>
                                <AnchorButton className={"full-zoom-button"} onClick={this.handleZoomToActualSizeClicked}>
                                    1.0x
                                </AnchorButton>
                            </Tooltip2>
                        )}
                        <Tooltip2 position={tooltipPosition} content={<span>Zoom to fit{currentZoomSpan}</span>}>
                            <AnchorButton icon="zoom-to-fit" onClick={this.props.onZoomToFit} />
                        </Tooltip2>
                        {!frame.isPreview && (
                            <>
                                <Popover2 content={wcsMatchingMenu} position={Position.TOP} minimal={true}>
                                    <Tooltip2
                                        position={tooltipPosition}
                                        content={
                                            <span>
                                                WCS Matching <br />
                                                <small>
                                                    <i>Current: {wcsButtonTooltip}</i>
                                                </small>
                                            </span>
                                        }
                                    >
                                        <AnchorButton icon="link" className="link-button">
                                            {wcsButtonSuperscript}
                                        </AnchorButton>
                                    </Tooltip2>
                                </Popover2>
                                <Popover2 content={coordinateSystemMenu} position={Position.TOP} minimal={true}>
                                    <Tooltip2
                                        position={tooltipPosition}
                                        content={
                                            <span>
                                                Overlay Coordinate <br />
                                                <small>
                                                    <i>Current: {ToolbarComponent.CoordinateSystemTooltip.get(coordinateSystem)}</i>
                                                </small>
                                            </span>
                                        }
                                    >
                                        <AnchorButton disabled={!frame.validWcs} text={ToolbarComponent.CoordinateSystemName.get(coordinateSystem)} />
                                    </Tooltip2>
                                </Popover2>
                            </>
                        )}
                        <Tooltip2 position={tooltipPosition} content="Toggle grid">
                            <AnchorButton icon="grid" active={grid.visible} onClick={() => grid.setVisible(!grid.visible)} />
                        </Tooltip2>
                        {!frame.isPreview && (
                            <>
                                <Tooltip2 position={tooltipPosition} content="Toggle labels">
                                    <AnchorButton icon="numerical" active={!overlay.labelsHidden} onClick={overlay.toggleLabels} />
                                </Tooltip2>
                                <Popover2 content={exportImageMenu} position={Position.TOP} minimal={true}>
                                    <Tooltip2
                                        position={tooltipPosition}
                                        content={
                                            <span>
                                                Export image
                                                {this.exportImageTooltip()}
                                            </span>
                                        }
                                    >
                                        <AnchorButton disabled={appStore.isExportingImage} icon="floppy-disk" />
                                    </Tooltip2>
                                </Popover2>
                            </>
                        )}
                    </React.Fragment>
                )}
                <Tooltip2 position={tooltipPosition} content={appStore.toolbarExpanded ? "Hide toolbar" : "Show toolbar"}>
                    <AnchorButton active={appStore.toolbarExpanded} icon={appStore.toolbarExpanded ? "double-chevron-right" : "double-chevron-left"} onClick={appStore.toggleToolbarExpanded} />
                </Tooltip2>
            </ButtonGroup>
        );
    }
}
