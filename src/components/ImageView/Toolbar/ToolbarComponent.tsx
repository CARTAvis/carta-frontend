import type {CSSProperties} from "react";
import * as React from "react";
import {AnchorButton, ButtonGroup, Classes, Collapse, FormGroup, type IconName, Menu, MenuDivider, MenuItem, PopoverInteractionKind, PopoverNext, type PopoverPosition, Position, Switch, Tooltip} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import classNames from "classnames";
import {observer} from "mobx-react";
import type {Point2D} from "models";

import {ImageViewComponent, OffsetCoordinateControlsComponent} from "components";
import {AnnotationMenuComponent, ExportImageMenuComponent} from "components/Shared";
import {ImageViewLayer, RegionMode, SystemType} from "enums";
import {CustomIcon, type CustomIconName} from "icons/CustomIcons";
import {AppStore} from "stores";
import {type FrameStore, RegionStore} from "stores/Frame";
import {toFixed} from "utilities";

import "./ToolbarComponent.scss";

export class ToolbarComponentProps {
    isDocked: boolean;
    isVisible: boolean;
    frame: FrameStore;
    activeLayer: ImageViewLayer;
    onActiveLayerChange: (layer: ImageViewLayer) => void;
    onRegionViewZoom: (zoom: number | Point2D) => void;
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
        [SystemType.ICRS, "ICRS"],
        [SystemType.Image, "IMG"]
    ]);

    private static readonly CoordinateSystemTooltip = new Map<SystemType, string>([
        [SystemType.Auto, "Automatically select the coordinate system based on file headers"],
        [SystemType.FK5, "FK5 coordinates, J2000.0 equinox"],
        [SystemType.FK4, "FK4 coordinates, B1950.0 equinox"],
        [SystemType.Galactic, "Galactic coordinates"],
        [SystemType.Ecliptic, "Ecliptic coordinates, J2000.0 equinox"],
        [SystemType.ICRS, "International Celestial Reference System"]
    ]);

    handleZoomToActualSizeClicked = () => {
        const zoom = 1.0;
        this.props.frame.setZoom(zoom);
        this.props.onRegionViewZoom(zoom);
    };

    handleZoomInClicked = () => {
        const frame = this.props.frame.spatialReference || this.props.frame;
        if (frame.isAxisZoomable && frame.zoomAxis !== "both") {
            const zoomX = frame.zoomAxis === "x" ? frame.effectiveZoomLevel.x * 2.0 : frame.effectiveZoomLevel.x;
            const zoomY = frame.zoomAxis === "y" ? frame.effectiveZoomLevel.y * 2.0 : frame.effectiveZoomLevel.y;
            frame.setAxisZoom(zoomX, zoomY);
            this.props.onRegionViewZoom({x: zoomX, y: zoomY});
        } else {
            const zoom = frame.zoomLevel * 2.0;
            frame.setZoom(zoom, true);
            this.props.onRegionViewZoom(zoom);
        }
    };

    handleZoomOutClicked = () => {
        const frame = this.props.frame.spatialReference || this.props.frame;
        if (frame.isAxisZoomable && frame.zoomAxis !== "both") {
            const zoomX = frame.zoomAxis === "x" ? frame.effectiveZoomLevel.x / 2.0 : frame.effectiveZoomLevel.x;
            const zoomY = frame.zoomAxis === "y" ? frame.effectiveZoomLevel.y / 2.0 : frame.effectiveZoomLevel.y;
            frame.setAxisZoom(zoomX, zoomY);
            this.props.onRegionViewZoom({x: zoomX, y: zoomY});
        } else {
            const zoom = frame.zoomLevel / 2.0;
            frame.setZoom(zoom, true);
            this.props.onRegionViewZoom(zoom);
        }
    };

    handleRegionTypeClicked = (type: CARTA.RegionType) => {
        this.props.frame.regionSet.setNewRegionType(type);
        this.props.frame.regionSet.setMode(RegionMode.CREATING);
    };

    handleCoordinateSystemClicked = (coordinateSystem: SystemType) => {
        AppStore.Instance.overlaySettings.global.setSystem(coordinateSystem);
        this.props.frame.updateOffsetCenter();
    };

    private handleActiveLayerClicked = (layer: ImageViewLayer) => {
        this.props.onActiveLayerChange(layer);
        if (layer === ImageViewLayer.RegionCreating) {
            this.props.frame.regionSet.setMode(RegionMode.CREATING);
        } else {
            this.props.frame.regionSet.setMode(RegionMode.MOVING);
        }
    };

    private handlePanZoomShortCutClicked = () => {
        const widgetsStore = AppStore.Instance.widgetsStore;
        const parentType = ImageViewComponent.WidgetConfig.type;
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
                        Background color is {AppStore.Instance.preferenceStore.hasTransparentImageBackground ? "transparent" : "filled"}.<br />
                        {AppStore.Instance.preferenceStore.hasTransparentImageBackground ? "Disable" : "Enable"} transparent image background in Preferences.
                        <br />
                    </small>
                </i>
            </span>
        );
    };

    render() {
        const appStore = AppStore.Instance;
        const overlay = AppStore.Instance.overlaySettings;
        const frame = this.props.frame;
        const grid = overlay.grid;

        const styleProps: CSSProperties = {
            bottom: frame.overlayStore.padding.bottom,
            right: frame.overlayStore.padding.right,
            left: frame.overlayStore.padding.left,
            opacity: this.props.isVisible ? 1 : 0,
            backgroundColor: "transparent"
        };

        const className = classNames("image-toolbar", {docked: this.props.isDocked, [Classes.DARK]: appStore.isDarkTheme});

        const zoomLevel = frame.spatialReference && frame.spatialTransform ? frame.spatialReference.zoomLevel * frame.spatialTransform.scale : frame.zoomLevel;
        const zoomFrame = frame.spatialReference && frame.spatialTransform ? frame.spatialReference : frame;
        const axisFrame = frame.spatialReference || frame;
        const currentZoomSpan = (
            <span>
                <br />
                <i>
                    <small>Current: {toFixed(zoomLevel, 2)}x</small>
                    {axisFrame.isAxisZoomable && Math.abs(zoomFrame.effectiveZoomLevel.x - zoomFrame.effectiveZoomLevel.y) > 1e-4 && (
                        <small>
                            <br />
                            X: {toFixed(zoomFrame.effectiveZoomLevel.x, 2)}x, Y: {toFixed(zoomFrame.effectiveZoomLevel.y, 2)}x
                        </small>
                    )}
                </i>
            </span>
        );
        const tooltipPosition: PopoverPosition = "top";

        const annotationMenu = (
            <Menu style={{padding: 0}}>
                <AnnotationMenuComponent handleRegionTypeClicked={this.handleRegionTypeClicked} />
            </Menu>
        );

        const zoomAxisMenu = (
            <Menu>
                <MenuItem text="Both (XY)" icon={axisFrame.zoomAxis === "both" ? "tick" : "blank"} onClick={() => axisFrame.setZoomAxis("both")} data-testid="pv-zoom-axis-both" />
                <MenuItem text="X Axis" icon={axisFrame.zoomAxis === "x" ? "tick" : "blank"} onClick={() => axisFrame.setZoomAxis("x")} data-testid="pv-zoom-axis-x" />
                <MenuItem text="Y Axis" icon={axisFrame.zoomAxis === "y" ? "tick" : "blank"} onClick={() => axisFrame.setZoomAxis("y")} data-testid="pv-zoom-axis-y" />
            </Menu>
        );

        const popoverProps = {
            position: Position.RIGHT_BOTTOM,
            interactionKind: PopoverInteractionKind.CLICK
        };

        const regionMenu = (
            <Menu>
                {Array.from(RegionStore.AVAILABLE_REGION_TYPES).map(([type, text], index) => {
                    const regionIconString: IconName | CustomIconName = RegionStore.regionIconString(type);
                    const regionIcon = RegionStore.isRegionCustomIcon(type) ? <CustomIcon icon={regionIconString as CustomIconName} /> : (regionIconString as IconName);
                    return <MenuItem icon={regionIcon} text={text} onClick={() => this.handleRegionTypeClicked(type)} key={index} />;
                })}
                <MenuDivider></MenuDivider>
                <MenuItem icon={"annotation"} text={"Annotations"} popoverProps={popoverProps}>
                    {annotationMenu}
                </MenuItem>
            </Menu>
        );

        const coordinateSystem = overlay.global.system;

        const coordinateSystemMenu = (
            <Menu>
                <MenuItem text={ToolbarComponent.CoordinateSystemName.get(SystemType.Auto)} onClick={() => this.handleCoordinateSystemClicked(SystemType.Auto)} />
                <MenuItem text={ToolbarComponent.CoordinateSystemName.get(SystemType.FK5)} onClick={() => this.handleCoordinateSystemClicked(SystemType.FK5)} />
                <MenuItem text={ToolbarComponent.CoordinateSystemName.get(SystemType.FK4)} onClick={() => this.handleCoordinateSystemClicked(SystemType.FK4)} />
                <MenuItem text={ToolbarComponent.CoordinateSystemName.get(SystemType.Galactic)} onClick={() => this.handleCoordinateSystemClicked(SystemType.Galactic)} />
                <MenuItem text={ToolbarComponent.CoordinateSystemName.get(SystemType.Ecliptic)} onClick={() => this.handleCoordinateSystemClicked(SystemType.Ecliptic)} />
                <MenuItem text={ToolbarComponent.CoordinateSystemName.get(SystemType.ICRS)} onClick={() => this.handleCoordinateSystemClicked(SystemType.ICRS)} />
                <MenuItem text={ToolbarComponent.CoordinateSystemName.get(SystemType.Image)} onClick={() => this.handleCoordinateSystemClicked(SystemType.Image)} />
                <FormGroup inline={false} className="offset-group">
                    <Switch className="offset-switch" disabled={frame.isPVImage || frame.isSwappedZ || frame.isUVImage} checked={frame.isOffsetCoord} onChange={frame.toggleOffsetCoord} label="Offset" />
                    <Collapse isOpen={frame.isOffsetCoord}>
                        <OffsetCoordinateControlsComponent
                            className="offset-collapse-content"
                            isWcsCoordinates={overlay.isWcsCoordinates && overlay.global.isValidWcs}
                            isOffsetCoord={frame.isOffsetCoord}
                            skyRefIs={frame.skyRefIs}
                            onSkyRefIsChanged={frame.setSkyRefIs}
                            onUpdateOffsetCenter={frame.updateOffsetCenter}
                        />
                    </Collapse>
                </FormGroup>
            </Menu>
        );

        const regionIconString: IconName | CustomIconName = RegionStore.regionIconString(frame.regionSet.newRegionType);
        const regionIcon = RegionStore.isRegionCustomIcon(frame.regionSet.newRegionType) ? <CustomIcon icon={regionIconString as CustomIconName} /> : (regionIconString as IconName);

        const isSpatialMatchingEnabled = !!frame.spatialReference;
        const isSpectralMatchingEnabled = !!frame.spectralReference;
        const canEnableSpatialMatching = appStore.spatialReference !== frame;
        const canEnableSpectralMatching = appStore.spectralReference && appStore.spectralReference !== frame && frame.frameInfo.fileInfoExtended.depth > 1;
        const wcsButtonSuperscript = (isSpatialMatchingEnabled ? "x" : "") + (isSpectralMatchingEnabled ? "z" : "");
        const wcsButtonTooltipEntries: string[] = [];
        if (isSpectralMatchingEnabled) {
            wcsButtonTooltipEntries.push(`Spectral (${appStore.spectralMatchingType})`);
        }
        if (isSpatialMatchingEnabled) {
            wcsButtonTooltipEntries.push("Spatial");
        }
        const wcsButtonTooltip = wcsButtonTooltipEntries.join(" and ") || "None";

        const wcsMatchingMenu = (
            <Menu>
                <MenuItem
                    text={`Spectral (${appStore.spectralMatchingType}) and spatial`}
                    disabled={!canEnableSpatialMatching || !canEnableSpectralMatching}
                    active={isSpectralMatchingEnabled && isSpatialMatchingEnabled}
                    onClick={() => appStore.setMatchingEnabled(true, true)}
                />
                <MenuItem
                    text={`Spectral (${appStore.spectralMatchingType})  only`}
                    disabled={!canEnableSpectralMatching}
                    active={isSpectralMatchingEnabled && !isSpatialMatchingEnabled}
                    onClick={() => appStore.setMatchingEnabled(false, true)}
                />
                <MenuItem text="Spatial only" disabled={!canEnableSpatialMatching} active={!isSpectralMatchingEnabled && isSpatialMatchingEnabled} onClick={() => appStore.setMatchingEnabled(true, false)} />
                <MenuItem text="None" disabled={!canEnableSpatialMatching} active={!isSpectralMatchingEnabled && !isSpatialMatchingEnabled} onClick={() => appStore.setMatchingEnabled(false, false)} />
            </Menu>
        );

        const exportImageMenu = (
            <Menu>
                <ExportImageMenuComponent />
            </Menu>
        );

        const baseFrame = this.props.frame;
        const numSourcesArray = appStore.catalogStore.visibleCatalogFiles.get(baseFrame)?.map(fileId => appStore.catalogStore.catalogCounts.get(fileId));
        const isNumSourcesZero = numSourcesArray?.every(element => element === 0);

        const isCatalogOverlayEnabled = appStore.activeLayer === ImageViewLayer.Catalog;
        const isCatalogSelectionDisabled = appStore.catalogNum === 0 || isNumSourcesZero === true;

        const handleDistanceMeasuringClicked = () => {
            this.handleActiveLayerClicked(ImageViewLayer.RegionCreating);
            const activeFrame = appStore.activeFrame;
            activeFrame?.regionSet.setNewRegionType(CARTA.RegionType.ANNRULER);
            activeFrame?.regionSet.setMode(RegionMode.CREATING);
        };

        return (
            <ButtonGroup className={className} style={styleProps}>
                {appStore.isToolbarExpanded && (
                    <React.Fragment>
                        {!frame.isPreview && (
                            <>
                                <Tooltip
                                    position={tooltipPosition}
                                    content={
                                        <span>
                                            Ruler annotation
                                            <br />
                                            <i>
                                                <small>Click-and-drag to create geodesic curves.</small>
                                            </i>
                                        </span>
                                    }
                                >
                                    <AnchorButton
                                        icon={<CustomIcon icon="distanceMeasuring" />}
                                        active={appStore.activeLayer === ImageViewLayer.RegionCreating}
                                        onClick={handleDistanceMeasuringClicked}
                                        data-testid="toolbar-distance-measuring-button"
                                    />
                                </Tooltip>
                                <Tooltip
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
                                    <AnchorButton
                                        icon={"locate"}
                                        active={isCatalogOverlayEnabled}
                                        onClick={() => this.handleActiveLayerClicked(ImageViewLayer.Catalog)}
                                        disabled={isCatalogSelectionDisabled}
                                        data-testid="toolbar-catalog-selection-button"
                                    />
                                </Tooltip>
                                {frame.regionSet.mode === RegionMode.CREATING && (
                                    <PopoverNext popoverClassName="region-menu" content={regionMenu} placement="top" animation="minimal" arrow={false} shouldReturnFocusOnClose={false}>
                                        <Tooltip
                                            position={tooltipPosition}
                                            content={
                                                <span>
                                                    Create{" "}
                                                    {frame.regionSet.isNewRegionAnnotation
                                                        ? `${RegionStore.AVAILABLE_ANNOTATION_TYPES.get(frame.regionSet.newRegionType)?.toLowerCase() ?? "unknown"} annotation`
                                                        : `${RegionStore.AVAILABLE_REGION_TYPES.get(frame.regionSet.newRegionType)?.toLowerCase() ?? "unknown"} region`}
                                                    <br />
                                                    <i>
                                                        <small>Click to select region or annotation type</small>
                                                    </i>
                                                </span>
                                            }
                                        >
                                            <AnchorButton
                                                icon={frame.regionSet.isNewRegionAnnotation ? "annotation" : regionIcon}
                                                active={appStore.activeLayer === ImageViewLayer.RegionCreating || appStore.activeFrame?.regionSet.mode === RegionMode.CREATING}
                                                onClick={() => this.handleActiveLayerClicked(ImageViewLayer.RegionCreating)}
                                            />
                                        </Tooltip>
                                    </PopoverNext>
                                )}
                                {frame.regionSet.mode === RegionMode.MOVING && (
                                    <Tooltip
                                        position={tooltipPosition}
                                        content={
                                            <span>
                                                Create{" "}
                                                {frame.regionSet.isNewRegionAnnotation
                                                    ? `${RegionStore.AVAILABLE_ANNOTATION_TYPES.get(frame.regionSet.newRegionType)?.toLowerCase() ?? "unknown"} annotation`
                                                    : `${RegionStore.AVAILABLE_REGION_TYPES.get(frame.regionSet.newRegionType)?.toLowerCase() ?? "unknown"} region`}
                                                <br />
                                                <i>
                                                    <small>
                                                        Double-click to select region or annotation type.
                                                        <br />
                                                        Press C to enter creation mode.
                                                    </small>
                                                </i>
                                            </span>
                                        }
                                    >
                                        <AnchorButton
                                            icon={frame.regionSet.isNewRegionAnnotation ? "annotation" : regionIcon}
                                            onClick={() => this.handleActiveLayerClicked(ImageViewLayer.RegionCreating)}
                                            data-testid="toolbar-region-creating-button"
                                        />
                                    </Tooltip>
                                )}
                                <Tooltip
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
                                        data-testid="toolbar-region-moving-button"
                                    />
                                </Tooltip>
                            </>
                        )}
                        {axisFrame.isAxisZoomable && (
                            <PopoverNext content={zoomAxisMenu} placement="top" animation="minimal" arrow={false} shouldReturnFocusOnClose={false}>
                                <Tooltip
                                    position={tooltipPosition}
                                    content={
                                        <span>
                                            Zoom Axis <br />
                                            <small>
                                                <i>Current: {axisFrame.zoomAxis === "x" ? "X Axis" : axisFrame.zoomAxis === "y" ? "Y Axis" : "Both (XY)"}</i>
                                            </small>
                                        </span>
                                    }
                                >
                                    <AnchorButton icon={axisFrame.zoomAxis === "x" ? "arrows-horizontal" : axisFrame.zoomAxis === "y" ? "arrows-vertical" : "move"} data-testid="pv-zoom-axis-button" />
                                </Tooltip>
                            </PopoverNext>
                        )}
                        <Tooltip position={tooltipPosition} content={<span>Zoom in (scroll wheel up){currentZoomSpan}</span>}>
                            <AnchorButton icon={"zoom-in"} onClick={this.handleZoomInClicked} data-testid="zoom-in-button" />
                        </Tooltip>
                        <Tooltip position={tooltipPosition} content={<span>Zoom out (scroll wheel down){currentZoomSpan}</span>}>
                            <AnchorButton icon={"zoom-out"} onClick={this.handleZoomOutClicked} data-testid="zoom-out-button" />
                        </Tooltip>
                        {!frame.isPreview && (
                            <Tooltip position={tooltipPosition} content={<span>Zoom to 1.0x{currentZoomSpan}</span>}>
                                <AnchorButton className={"full-zoom-button"} onClick={this.handleZoomToActualSizeClicked} data-testid="zoom-to-1x-fit-button">
                                    1.0x
                                </AnchorButton>
                            </Tooltip>
                        )}
                        <Tooltip position={tooltipPosition} content={<span>Zoom to fit{currentZoomSpan}</span>}>
                            <AnchorButton icon="zoom-to-fit" onClick={this.props.onZoomToFit} data-testid="zoom-to-fit-button" />
                        </Tooltip>
                        {!frame.isPreview && (
                            <>
                                <PopoverNext content={wcsMatchingMenu} placement="top" animation="minimal" arrow={false} shouldReturnFocusOnClose={false}>
                                    <Tooltip
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
                                        <AnchorButton icon="link" className="link-button" data-testid="match-button">
                                            {wcsButtonSuperscript}
                                        </AnchorButton>
                                    </Tooltip>
                                </PopoverNext>
                                <PopoverNext content={coordinateSystemMenu} placement="top" animation="minimal" arrow={false} shouldReturnFocusOnClose={false}>
                                    <Tooltip
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
                                        <AnchorButton disabled={!frame.isValidWcs} text={ToolbarComponent.CoordinateSystemName.get(coordinateSystem)} data-testid="overlay-coordinate-button" />
                                    </Tooltip>
                                </PopoverNext>
                            </>
                        )}
                        <Tooltip position={tooltipPosition} content="Toggle grid">
                            <AnchorButton icon="grid" active={grid.isVisible} onClick={() => grid.setVisible(!grid.isVisible)} data-testid="grid-button" />
                        </Tooltip>
                        {!frame.isPreview && (
                            <>
                                <Tooltip position={tooltipPosition} content="Toggle labels">
                                    <AnchorButton icon="numerical" active={!overlay.isLabelsHidden} onClick={overlay.toggleLabels} data-testid="toggle-labels-button" />
                                </Tooltip>
                                <PopoverNext content={exportImageMenu} placement="top" animation="minimal" arrow={false} shouldReturnFocusOnClose={false}>
                                    <Tooltip
                                        position={tooltipPosition}
                                        content={
                                            <span>
                                                Export image
                                                {this.exportImageTooltip()}
                                            </span>
                                        }
                                    >
                                        <AnchorButton disabled={appStore.isExportingImage} icon="floppy-disk" data-testid="export-image-view-button" />
                                    </Tooltip>
                                </PopoverNext>
                            </>
                        )}
                    </React.Fragment>
                )}
                <Tooltip position={tooltipPosition} content={appStore.isToolbarExpanded ? "Hide toolbar" : "Show toolbar"}>
                    <AnchorButton active={appStore.isToolbarExpanded} icon={appStore.isToolbarExpanded ? "double-chevron-right" : "double-chevron-left"} onClick={appStore.toggleToolbarExpanded} data-testid="toggle-toolbar-button" />
                </Tooltip>
            </ButtonGroup>
        );
    }
}
