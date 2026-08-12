import type {CSSProperties} from "react";
import * as React from "react";
import {AnchorButton, Menu, MenuDivider, MenuItem, NonIdealState, Tooltip} from "@blueprintjs/core";
import {Cell, Column, ColumnHeaderCell, type MenuContext, RowHeaderCell, SelectionModes, Table} from "@blueprintjs/table";
import classNames from "classnames";
import {action, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {ResizeDetector} from "components/Shared";
import {HelpType, ImageType, LayerListSettingsTabs} from "enums";
import {type ImageItem} from "models";
import {AppStore, type DefaultWidgetConfig, type WidgetProps} from "stores";

import "./LayerListComponent.scss";

@observer
export class LayerListComponent extends React.Component<WidgetProps> {
    public static get WidgetConfig(): DefaultWidgetConfig {
        return {
            id: "layer-list",
            type: "layer-list",
            minWidth: 350,
            minHeight: 180,
            defaultWidth: 650,
            defaultHeight: 180,
            title: "Image List",
            isCloseable: true,
            helpType: HelpType.LAYER_LIST
        };
    }

    @observable width: number = 650;
    @observable height: number = 180;
    @observable columnWidths = [132, 97, 140, 75, 95];

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    @action private onColumnWidthsChange = (index: number, size: number) => {
        if (!Number.isInteger(index) || index < 0 || index >= this.columnWidths.length || size <= 0) {
            return;
        }
        this.columnWidths[index] = size;
        this.forceUpdate();
    };

    @action private onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    private handleFileReordered = (oldIndex: number, newIndex: number, length: number) => {
        if (oldIndex === newIndex) {
            return;
        }
        AppStore.Instance.reorderFrame(oldIndex, newIndex, length);
    };

    private rowHeaderCellRenderer = (rowIndex: number) => {
        const className = classNames("row-cell", {active: rowIndex === AppStore.Instance.activeImageIndex});
        return <RowHeaderCell name={rowIndex.toString()} className={className} />;
    };

    private onFileSelected = (image: ImageItem) => {
        AppStore.Instance.updateActiveImage(image);
    };

    private fileNameRenderer = (rowIndex: number) => {
        const appStore = AppStore.Instance;
        const config = appStore.imageViewConfigStore;
        if (rowIndex < 0 || rowIndex >= config?.imageNum) {
            return <Cell />;
        }

        const image = config?.getImage(rowIndex);
        const filename = image?.store?.filename;
        const className = classNames("row-cell", {active: rowIndex === appStore.activeImageIndex});

        return (
            <Cell className={className} tooltip={filename}>
                <React.Fragment>
                    <div className="name-cell" onClick={() => this.onFileSelected(image)} data-testid={"image-list-" + rowIndex + "-image-name"}>
                        {filename}
                    </div>
                </React.Fragment>
            </Cell>
        );
    };

    private channelRenderer = (rowIndex: number) => {
        const appStore = AppStore.Instance;
        const config = appStore.imageViewConfigStore;
        const image = config?.getImage(rowIndex);
        if (rowIndex < 0 || rowIndex >= config?.imageNum || image?.type === ImageType.COLOR_BLENDING) {
            return <Cell />;
        }

        const className = classNames("row-cell", {active: rowIndex === appStore.activeImageIndex});
        return <Cell className={className}>{image?.store?.requiredChannel}</Cell>;
    };

    private stokesRenderer = (rowIndex: number) => {
        const appStore = AppStore.Instance;
        const config = appStore.imageViewConfigStore;
        const image = config?.getImage(rowIndex);
        if (rowIndex < 0 || rowIndex >= config?.imageNum || image?.type === ImageType.COLOR_BLENDING) {
            return <Cell />;
        }

        const className = classNames("row-cell", {active: rowIndex === appStore.activeImageIndex});
        return <Cell className={className}>{image?.store?.requiredPolarizationInfo}</Cell>;
    };

    private typeRenderer = (rowIndex: number) => {
        const appStore = AppStore.Instance;
        const config = appStore.imageViewConfigStore;
        const image = config?.getImage(rowIndex);
        if (rowIndex < 0 || rowIndex >= config?.imageNum) {
            return <Cell />;
        }

        const isColorBlending = image?.type === ImageType.COLOR_BLENDING;
        const frame = isColorBlending ? image.store?.baseFrame : image?.store;

        if (!frame) {
            return <Cell className={classNames("row-cell", {active: rowIndex === appStore.activeImageIndex})} />;
        }

        const isRasterVisible = isColorBlending ? image.store.isRasterVisible : frame.renderConfig.isVisible;
        const toggleRasterVisible = isColorBlending ? image.store.toggleRasterVisible : frame.renderConfig.toggleVisibility;

        const shouldShowContourButton = isColorBlending ? image.store.frames.map(f => f.contourConfig.isEnabled).includes(true) : frame.contourConfig.isEnabled;
        const isContourVisible = isColorBlending ? image.store.isContourVisible : frame.contourConfig.isVisible;
        const toggleContourVisible = isColorBlending ? image.store.toggleContourVisible : frame.contourConfig.toggleVisibility;

        const shouldShowVectorOverlayButton = isColorBlending ? image.store.frames.map(f => f.vectorOverlayConfig.isEnabled).includes(true) : frame.vectorOverlayConfig.isEnabled;
        const isVectorOverlayVisible = isColorBlending ? image.store.isVectorOverlayVisible : frame.vectorOverlayConfig.isVisible;
        const toggleVectorOverlayVisible = isColorBlending ? image.store.toggleVectorOverlayVisible : frame.vectorOverlayConfig.toggleVisibility;

        const className = classNames("row-cell", {active: rowIndex === appStore.activeImageIndex});
        return (
            <Cell className={className}>
                <React.Fragment>
                    <Tooltip
                        position={"bottom"}
                        content={
                            <span>
                                Raster layer
                                <br />
                                <i>
                                    <small>Click to {isRasterVisible ? "hide" : "show"}</small>
                                </i>
                            </span>
                        }
                    >
                        <AnchorButton variant="minimal" size="small" active={isRasterVisible} intent={isRasterVisible ? "success" : "none"} onClick={toggleRasterVisible}>
                            R
                        </AnchorButton>
                    </Tooltip>
                    {shouldShowContourButton && (
                        <Tooltip
                            position={"bottom"}
                            content={
                                <span>
                                    Contour layer
                                    <br />
                                    <i>
                                        <small>Click to {isContourVisible ? "hide" : "show"}</small>
                                    </i>
                                </span>
                            }
                        >
                            <AnchorButton variant="minimal" size="small" active={isContourVisible} intent={isContourVisible ? "success" : "none"} onClick={toggleContourVisible}>
                                C
                            </AnchorButton>
                        </Tooltip>
                    )}
                    {shouldShowVectorOverlayButton && (
                        <Tooltip
                            position={"bottom"}
                            content={
                                <span>
                                    Vector overlay layer
                                    <br />
                                    <i>
                                        <small>Click to {isVectorOverlayVisible ? "hide" : "show"}</small>
                                    </i>
                                </span>
                            }
                        >
                            <AnchorButton variant="minimal" size="small" active={isVectorOverlayVisible} intent={isVectorOverlayVisible ? "success" : "none"} onClick={toggleVectorOverlayVisible}>
                                V
                            </AnchorButton>
                        </Tooltip>
                    )}
                </React.Fragment>
            </Cell>
        );
    };

    private matchingRenderer = (rowIndex: number) => {
        const appStore = AppStore.Instance;
        const config = appStore.imageViewConfigStore;
        const image = config?.getImage(rowIndex);
        if (rowIndex < 0 || rowIndex >= config?.imageNum || image?.type === ImageType.COLOR_BLENDING) {
            return <Cell />;
        }

        const frame = image?.store;

        let spatialMatchingButton: React.ReactNode;
        if (appStore.spatialReference) {
            const isSpatialReference = frame === appStore.spatialReference;
            let tooltipSubtitle: string;
            if (isSpatialReference) {
                tooltipSubtitle = "Click to match or unmatch all images to this reference";
            } else {
                tooltipSubtitle = `Click to ${frame.spatialReference ? "disable" : "enable"} matching to ${appStore.spatialReference.filename}`;
            }
            spatialMatchingButton = (
                <Tooltip
                    position={"bottom"}
                    content={
                        <span>
                            Spatial matching
                            <br />
                            <i>
                                <small>{tooltipSubtitle}</small>
                            </i>
                        </span>
                    }
                >
                    <AnchorButton
                        className={classNames("matching-button", {outlined: isSpatialReference})}
                        variant="minimal"
                        size="small"
                        active={!!frame.spatialReference}
                        intent={frame.spatialReference ? "success" : "none"}
                        onClick={() => (isSpatialReference ? appStore.matchAllSpatial() : appStore.toggleSpatialMatching(frame))}
                        data-testid={"image-list-" + rowIndex + "-matching-xy"}
                    >
                        XY
                    </AnchorButton>
                </Tooltip>
            );
        }

        const hasSpectralAxis = frame.frameInfo.fileInfoExtended.depth > 1;
        const spectralReference = appStore.spectralReference;
        let spectralTooltipSubtitle: string;
        if (!hasSpectralAxis) {
            spectralTooltipSubtitle = "Spectral matching is unavailable because this image has no Z axis";
        } else if (!spectralReference) {
            spectralTooltipSubtitle = "No spectral reference is available";
        } else if (frame === spectralReference) {
            spectralTooltipSubtitle = "Click to match or unmatch all matchable cubes to this reference";
        } else {
            spectralTooltipSubtitle = `Click to ${frame.spectralReference ? "disable" : "enable"} matching to ${spectralReference.filename}`;
        }

        const spectralMatchingButton = (
            <Tooltip
                position={"bottom"}
                content={
                    <span>
                        Spectral matching
                        <br />
                        <i>
                            <small>{spectralTooltipSubtitle}</small>
                        </i>
                    </span>
                }
            >
                <AnchorButton
                    className={classNames("matching-button", {outlined: frame === spectralReference})}
                    variant="minimal"
                    size="small"
                    active={!!frame.spectralReference}
                    intent={frame.spectralReference ? "success" : "none"}
                    disabled={!hasSpectralAxis || !spectralReference}
                    onClick={() => (frame === spectralReference ? appStore.matchAllSpectral() : appStore.toggleSpectralMatching(frame))}
                    data-testid={"image-list-" + rowIndex + "-matching-z"}
                >
                    Z
                </AnchorButton>
            </Tooltip>
        );

        const timeSeriesStore = appStore.timeSeriesStore;
        const isTimeSeriesMember = timeSeriesStore.isMember(frame);
        const canBeTimeSeriesMember = timeSeriesStore.canBeMember(frame);
        const isTimeSeriesBulkAnchor = canBeTimeSeriesMember && rowIndex === appStore.activeImageIndex;
        const eligibleTimeSeriesFrames = isTimeSeriesBulkAnchor ? appStore.frames.filter(timeSeriesStore.canBeMember) : [];
        const areAllEligibleFramesMembers = isTimeSeriesBulkAnchor && eligibleTimeSeriesFrames.length > 0 && eligibleTimeSeriesFrames.every(timeSeriesStore.isMember);
        const isTimeSeriesMemberToggleDisabled = !canBeTimeSeriesMember || appStore.animatorStore.isAnimationActive;
        const timeSeriesTooltipSubtitle = !canBeTimeSeriesMember
            ? "A valid DATE-OBS or MJD-OBS is required"
            : appStore.animatorStore.isAnimationActive
              ? "Stop playback before changing time-series membership"
              : isTimeSeriesBulkAnchor
                ? areAllEligibleFramesMembers
                    ? "Click to remove all images from the time series"
                    : "Click to add all eligible images to the time series"
                : `Click to ${isTimeSeriesMember ? "remove this image from" : "add this image to"} the time series`;
        const timeSeriesMembershipButton = (
            <Tooltip
                position={"bottom"}
                content={
                    <span>
                        Time series member
                        <br />
                        <i>
                            <small>{timeSeriesTooltipSubtitle}</small>
                        </i>
                    </span>
                }
            >
                <AnchorButton
                    className={classNames("matching-button", {
                        outlined: isTimeSeriesBulkAnchor,
                        "time-series-member-disabled": isTimeSeriesMember && appStore.animatorStore.isAnimationActive
                    })}
                    variant="minimal"
                    size="small"
                    active={isTimeSeriesMember}
                    intent={isTimeSeriesMember ? "success" : "none"}
                    disabled={isTimeSeriesMemberToggleDisabled}
                    onClick={() => (isTimeSeriesBulkAnchor ? appStore.toggleAllEligibleTimeSeriesMembers(frame) : appStore.toggleTimeSeriesMember(frame))}
                    aria-label={isTimeSeriesBulkAnchor ? "Toggle all eligible time-series members" : "Toggle time-series membership"}
                    data-testid={"image-list-" + rowIndex + "-matching-t"}
                >
                    T
                </AnchorButton>
            </Tooltip>
        );

        let renderConfigMatchingButton: React.ReactNode;
        if (appStore.rasterScalingReference) {
            const isRasterScalingReference = frame === appStore.rasterScalingReference;
            let tooltipSubtitle: string;
            if (isRasterScalingReference) {
                tooltipSubtitle = "Click to match or unmatch all images to this reference";
            } else {
                tooltipSubtitle = `Click to ${frame.rasterScalingReference ? "disable" : "enable"} matching to ${appStore.rasterScalingReference.filename}`;
            }
            renderConfigMatchingButton = (
                <Tooltip
                    position={"bottom"}
                    content={
                        <span>
                            Raster scaling matching
                            <br />
                            <i>
                                <small>{tooltipSubtitle}</small>
                            </i>
                        </span>
                    }
                >
                    <AnchorButton
                        className={classNames("matching-button", {outlined: isRasterScalingReference})}
                        variant="minimal"
                        size="small"
                        active={!!frame.rasterScalingReference}
                        intent={frame.rasterScalingReference ? "success" : "none"}
                        onClick={() => (isRasterScalingReference ? appStore.matchAllRasterScaling() : appStore.toggleRasterScalingMatching(frame))}
                        data-testid={"image-list-" + rowIndex + "-matching-r"}
                    >
                        R
                    </AnchorButton>
                </Tooltip>
            );
        }

        const className = classNames("row-cell", {active: rowIndex === appStore.activeImageIndex});
        return (
            <Cell className={className}>
                <div className="matching-controls">
                    <div className="matching-control-slot">{spatialMatchingButton}</div>
                    <div className="matching-control-slot">{spectralMatchingButton}</div>
                    <div className="matching-control-slot">{timeSeriesMembershipButton}</div>
                    <div className="matching-control-slot">{renderConfigMatchingButton}</div>
                </div>
            </Cell>
        );
    };

    private columnHeaderRenderer = (columnIndex: number) => {
        let name: string = "";
        switch (columnIndex) {
            case 0:
                name = "Image";
                break;
            case 1:
                name = "Layers";
                break;
            case 2:
                name = "Matching";
                break;
            case 3:
                name = "Channel";
                break;
            case 4:
                name = "Polarization";
                break;
            default:
                name = "";
                break;
        }

        const columnHeaderStyleProps: CSSProperties = {
            fontSize: "12",
            fontWeight: "bold"
        };

        return <ColumnHeaderCell name={name} style={columnHeaderStyleProps} />;
    };

    private restFreqShortCutOnClick = (selectedFrameIndex: number) => {
        const widgetsStore = AppStore.Instance.widgetsStore;
        const layerListWidget = widgetsStore.layerListWidgets?.get(this.props.id);
        const title = LayerListComponent.WidgetConfig.title;
        if (title) {
            widgetsStore.createFloatingSettingsWidget(title, this.props.id, LayerListComponent.WidgetConfig.type);
        }
        if (layerListWidget) {
            layerListWidget.setSettingsTabId(LayerListSettingsTabs.REST_FREQ);
            layerListWidget.setSelectedFrameIndex(selectedFrameIndex);
        }
    };

    private contextMenuRenderer = (context: MenuContext): React.JSX.Element => {
        const rows = context.getTarget().rows;
        const appStore = AppStore.Instance;
        if (!rows || !rows.length) {
            return <Menu />;
        }
        const image = appStore.imageViewConfigStore?.getImage(rows[0]);
        if (rows && rows.length && image) {
            if (image.type === ImageType.COLOR_BLENDING) {
                return (
                    <Menu>
                        <MenuItem text="Close image" onClick={() => appStore.closeImage(image)} />
                        <MenuItem text="Close all images" disabled={appStore.imageViewConfigStore?.imageNum <= 1} onClick={() => appStore.removeAllFrames()} />
                        <MenuDivider />
                        <MenuItem text="Sort images by time" disabled={appStore.imageViewConfigStore?.imageNum <= 1} onClick={() => appStore.sortFramesByTime()} />
                    </Menu>
                );
            } else {
                const frame = image?.store;
                if (frame) {
                    const canSetSpectralReference = frame.frameInfo.fileInfoExtended.depth > 1;
                    const areAllReferencesAlreadySet = appStore.spatialReference === frame && appStore.rasterScalingReference === frame && (!canSetSpectralReference || appStore.spectralReference === frame);
                    return (
                        <Menu>
                            <MenuDivider title={frame.filename} />
                            <MenuItem disabled={areAllReferencesAlreadySet} text="Set as all references" onClick={() => appStore.setAllReferences(frame)} />
                            <MenuItem disabled={appStore.spatialReference === frame} text="Set as spatial reference" onClick={() => appStore.setSpatialReference(frame)} />
                            <MenuItem disabled={appStore.spectralReference === frame || !canSetSpectralReference} text="Set as spectral reference" onClick={() => appStore.setSpectralReference(frame)} />
                            <MenuItem disabled={appStore.rasterScalingReference === frame} text="Set as raster scaling reference" onClick={() => appStore.setRasterScalingReference(frame)} />
                            <MenuDivider />
                            <MenuItem disabled={!frame.isRestFreqEditable} text="Set rest frequency" onClick={() => this.restFreqShortCutOnClick(rows[0])} />
                            <MenuDivider />
                            <MenuItem text="Close image" onClick={() => appStore.closeImage(image)} />
                            <MenuItem text="Close other images" disabled={appStore.imageViewConfigStore?.imageNum <= 1} onClick={() => appStore.closeOtherImages(frame)} />
                            <MenuItem text="Close all images" disabled={appStore.imageViewConfigStore?.imageNum <= 1} onClick={() => appStore.removeAllFrames()} />
                            <MenuDivider />
                            <MenuItem text="Sort images by time" disabled={appStore.imageViewConfigStore?.imageNum <= 1} onClick={() => appStore.sortFramesByTime()} />
                        </Menu>
                    );
                }
            }
        }
        return <Menu />;
    };

    render() {
        const appStore = AppStore.Instance;
        const imageNum = appStore.imageViewConfigStore?.imageNum;

        if (imageNum <= 0) {
            return (
                <ResizeDetector onResize={this.onResize}>
                    <div className="layer-list-widget">
                        <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />
                    </div>
                </ResizeDetector>
            );
        }

        // This is a necessary hack in order to trigger a re-rendering when values change, because the cell renderer is in its own function
        // There is probably a neater way to do this, though
        const frameChannels = appStore.frameChannels;
        const frameStokes = appStore.frameStokes;
        const activeImageIndex = appStore.activeImageIndex;
        const visibilityRaster = appStore.frames.map(f => f.renderConfig.isVisible);
        const visibilityContour = appStore.frames.map(f => f.contourConfig.isVisible && f.contourConfig.isEnabled);
        const visibilityVector = appStore.frames.map(f => f.vectorOverlayConfig.isVisible && f.vectorOverlayConfig.isEnabled);
        const blendingVisibilityRaster = appStore.imageViewConfigStore.colorBlendingImages.map(x => x.isRasterVisible);
        const blendingVisibilityContour = appStore.imageViewConfigStore.colorBlendingImages.map(x => x.isContourVisible);
        const blendingVisibilityVector = appStore.imageViewConfigStore.colorBlendingImages.map(x => x.isVectorOverlayVisible);
        const f1 = appStore.frames.map(f => f.spatialReference);
        const f2 = appStore.frames.map(f => f.spectralReference);
        const f3 = appStore.frames.map(f => f.rasterScalingReference);
        const currentSpectralReference = appStore.spectralReference;
        const currentSpatialReference = appStore.spatialReference;
        const currentRasterScalingReference = appStore.rasterScalingReference;
        const timeSeriesMembership = appStore.frames.map(frame => appStore.timeSeriesStore.isMember(frame));
        const isAnimationActive = appStore.animatorStore.isAnimationActive;
        const cellRendererDependencies = [
            frameChannels,
            frameStokes,
            activeImageIndex,
            visibilityRaster,
            visibilityContour,
            visibilityVector,
            blendingVisibilityRaster,
            blendingVisibilityContour,
            blendingVisibilityVector,
            f1,
            f2,
            f3,
            currentSpectralReference,
            currentSpatialReference,
            currentRasterScalingReference,
            timeSeriesMembership,
            isAnimationActive
        ];

        return (
            <ResizeDetector onResize={this.onResize}>
                <div className="layer-list-widget">
                    {this.width > 0 && (
                        <Table
                            numRows={imageNum}
                            rowHeaderCellRenderer={this.rowHeaderCellRenderer}
                            enableRowHeader={true}
                            enableRowReordering={true}
                            enableRowResizing={false}
                            selectionModes={SelectionModes.ROWS_ONLY}
                            enableMultipleSelection={true}
                            onRowsReordered={this.handleFileReordered}
                            columnWidths={this.columnWidths}
                            enableColumnResizing={true}
                            onColumnWidthChanged={this.onColumnWidthsChange}
                            bodyContextMenuRenderer={this.contextMenuRenderer}
                            cellRendererDependencies={cellRendererDependencies}
                            getCellClipboardData={undefined}
                        >
                            <Column columnHeaderCellRenderer={this.columnHeaderRenderer} cellRenderer={this.fileNameRenderer} />
                            <Column columnHeaderCellRenderer={this.columnHeaderRenderer} cellRenderer={this.typeRenderer} />
                            <Column columnHeaderCellRenderer={this.columnHeaderRenderer} cellRenderer={this.matchingRenderer} />
                            <Column columnHeaderCellRenderer={this.columnHeaderRenderer} cellRenderer={this.channelRenderer} />
                            <Column columnHeaderCellRenderer={this.columnHeaderRenderer} cellRenderer={this.stokesRenderer} />
                        </Table>
                    )}
                </div>
            </ResizeDetector>
        );
    }
}
