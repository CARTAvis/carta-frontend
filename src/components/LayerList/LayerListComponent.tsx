import * as React from "react";
import {CSSProperties} from "react";
import {AnchorButton, Menu, MenuDivider, MenuItem, NonIdealState, Tooltip} from "@blueprintjs/core";
import {Cell, Column, ColumnHeaderCell, MenuContext, RowHeaderCell, SelectionModes, Table2} from "@blueprintjs/table";
import classNames from "classnames";
import {action, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {ResizeDetector} from "components/Shared";
import {ImageItem, ImageType} from "models";
import {AppStore, DefaultWidgetConfig, HelpType, WidgetProps} from "stores";
import {LayerListSettingsTabs} from "stores/Widgets";

import "./LayerListComponent.scss";

@observer
export class LayerListComponent extends React.Component<WidgetProps> {
    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
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

    @observable width: number = 0;
    @observable height: number = 0;
    @observable columnWidths = [132, 97, 110, 75, 95];

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

        const rasterVisible = isColorBlending ? image.store.rasterVisible : frame.renderConfig.visible;
        const toggleRasterVisible = isColorBlending ? image.store.toggleRasterVisible : frame.renderConfig.toggleVisibility;

        const showContourButton = isColorBlending ? image.store.frames.map(f => f.contourConfig.enabled).includes(true) : frame.contourConfig.enabled;
        const contourVisible = isColorBlending ? image.store.contourVisible : frame.contourConfig.visible;
        const toggleContourVisible = isColorBlending ? image.store.toggleContourVisible : frame.contourConfig.toggleVisibility;

        const showVectorOverlayButton = isColorBlending ? image.store.frames.map(f => f.vectorOverlayConfig.enabled).includes(true) : frame.vectorOverlayConfig.enabled;
        const vectorOverlayVisible = isColorBlending ? image.store.vectorOverlayVisible : frame.vectorOverlayConfig.visible;
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
                                    <small>Click to {rasterVisible ? "hide" : "show"}</small>
                                </i>
                            </span>
                        }
                    >
                        <AnchorButton minimal={true} small={true} active={rasterVisible} intent={rasterVisible ? "success" : "none"} onClick={toggleRasterVisible}>
                            R
                        </AnchorButton>
                    </Tooltip>
                    {showContourButton && (
                        <Tooltip
                            position={"bottom"}
                            content={
                                <span>
                                    Contour layer
                                    <br />
                                    <i>
                                        <small>Click to {contourVisible ? "hide" : "show"}</small>
                                    </i>
                                </span>
                            }
                        >
                            <AnchorButton minimal={true} small={true} active={contourVisible} intent={contourVisible ? "success" : "none"} onClick={toggleContourVisible}>
                                C
                            </AnchorButton>
                        </Tooltip>
                    )}
                    {showVectorOverlayButton && (
                        <Tooltip
                            position={"bottom"}
                            content={
                                <span>
                                    Vector overlay layer
                                    <br />
                                    <i>
                                        <small>Click to {vectorOverlayVisible ? "hide" : "show"}</small>
                                    </i>
                                </span>
                            }
                        >
                            <AnchorButton minimal={true} small={true} active={vectorOverlayVisible} intent={vectorOverlayVisible ? "success" : "none"} onClick={toggleVectorOverlayVisible}>
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
            let tooltipSubtitle: string;
            if (frame === appStore.spatialReference) {
                tooltipSubtitle = `${frame.filename} is the current spatial reference`;
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
                        className={classNames({outlined: frame === appStore.spatialReference})}
                        minimal={true}
                        small={true}
                        active={!!frame.spatialReference}
                        intent={frame.spatialReference ? "success" : "none"}
                        onClick={() => appStore.toggleSpatialMatching(frame)}
                        data-testid={"image-list-" + rowIndex + "-matching-xy"}
                    >
                        XY
                    </AnchorButton>
                </Tooltip>
            );
        }

        let spectralMatchingButton: React.ReactNode;
        if (frame.frameInfo.fileInfoExtended.depth > 1 && appStore.spectralReference) {
            let tooltipSubtitle: string;
            if (frame === appStore.spectralReference) {
                tooltipSubtitle = `${frame.filename} is the current spectral reference`;
            } else {
                tooltipSubtitle = `Click to ${frame.spectralReference ? "disable" : "enable"} matching to ${appStore.spectralReference.filename}`;
            }
            spectralMatchingButton = (
                <Tooltip
                    position={"bottom"}
                    content={
                        <span>
                            Spectral matching
                            <br />
                            <i>
                                <small>{tooltipSubtitle}</small>
                            </i>
                        </span>
                    }
                >
                    <AnchorButton
                        className={classNames({outlined: frame === appStore.spectralReference})}
                        minimal={true}
                        small={true}
                        active={!!frame.spectralReference}
                        intent={frame.spectralReference ? "success" : "none"}
                        onClick={() => appStore.toggleSpectralMatching(frame)}
                        data-testid={"image-list-" + rowIndex + "-matching-z"}
                    >
                        Z
                    </AnchorButton>
                </Tooltip>
            );
        }

        let renderConfigMatchingButton: React.ReactNode;
        if (appStore.rasterScalingReference) {
            let tooltipSubtitle: string;
            if (frame === appStore.rasterScalingReference) {
                tooltipSubtitle = `${frame.filename} is the current raster scaling reference`;
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
                        className={classNames({outlined: frame === appStore.rasterScalingReference})}
                        minimal={true}
                        small={true}
                        active={!!frame.rasterScalingReference}
                        intent={frame.rasterScalingReference ? "success" : "none"}
                        onClick={() => appStore.toggleRasterScalingMatching(frame)}
                    >
                        R
                    </AnchorButton>
                </Tooltip>
            );
        }

        const className = classNames("row-cell", {active: rowIndex === appStore.activeImageIndex});
        return (
            <Cell className={className}>
                <React.Fragment>
                    {spatialMatchingButton}
                    {spectralMatchingButton}
                    {renderConfigMatchingButton}
                </React.Fragment>
            </Cell>
        );
    };

    private columnHeaderRenderer = (columnIndex: number) => {
        let name: string;
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
        widgetsStore.createFloatingSettingsWidget(LayerListComponent.WIDGET_CONFIG.title, this.props.id, LayerListComponent.WIDGET_CONFIG.type);
        if (layerListWidget) {
            layerListWidget.setSettingsTabId(LayerListSettingsTabs.REST_FREQ);
            layerListWidget.setSelectedFrameIndex(selectedFrameIndex);
        }
    };

    private contextMenuRenderer = (context: MenuContext) => {
        const rows = context.getTarget().rows;
        const appStore = AppStore.Instance;
        const image = appStore.imageViewConfigStore?.getImage(rows[0]);
        if (rows && rows.length && image) {
            if (image.type === ImageType.COLOR_BLENDING) {
                return (
                    <Menu>
                        <MenuItem text="Close image" onClick={() => appStore.closeImage(image)} />
                        <MenuItem text="Close all images" disabled={appStore.imageViewConfigStore?.imageNum <= 1} onClick={() => appStore.closeOtherImages(null)} />
                    </Menu>
                );
            } else {
                const frame = image?.store;
                if (frame) {
                    return (
                        <Menu>
                            <MenuDivider title={frame.filename} />
                            <MenuItem disabled={appStore.spatialReference === frame} text="Set as spatial reference" onClick={() => appStore.setSpatialReference(frame)} />
                            <MenuItem disabled={appStore.spectralReference === frame || frame.frameInfo.fileInfoExtended.depth <= 1} text="Set as spectral reference" onClick={() => appStore.setSpectralReference(frame)} />
                            <MenuItem disabled={appStore.rasterScalingReference === frame} text="Set as raster scaling reference" onClick={() => appStore.setRasterScalingReference(frame)} />
                            <MenuDivider />
                            <MenuItem disabled={!frame.isRestFreqEditable} text="Set rest frequency" onClick={() => this.restFreqShortCutOnClick(rows[0])} />
                            <MenuDivider />
                            <MenuItem text="Close image" onClick={() => appStore.closeImage(image)} />
                            <MenuItem text="Close other images" disabled={appStore.imageViewConfigStore?.imageNum <= 1} onClick={() => appStore.closeOtherImages(frame)} />
                            <MenuItem text="Close all images" disabled={appStore.imageViewConfigStore?.imageNum <= 1} onClick={() => appStore.closeOtherImages(null)} />
                        </Menu>
                    );
                }
            }
        }
        return null;
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
        const visibilityRaster = appStore.frames.map(f => f.renderConfig.visible);
        const visibilityContour = appStore.frames.map(f => f.contourConfig.visible && f.contourConfig.enabled);
        const visibilityVector = appStore.frames.map(f => f.vectorOverlayConfig.visible && f.vectorOverlayConfig.enabled);
        const blendingVisibilityRaster = appStore.imageViewConfigStore.colorBlendingImages.map(x => x.rasterVisible);
        const blendingVisibilityContour = appStore.imageViewConfigStore.colorBlendingImages.map(x => x.contourVisible);
        const blendingVisibilityVector = appStore.imageViewConfigStore.colorBlendingImages.map(x => x.vectorOverlayVisible);
        const f1 = appStore.frames.map(f => f.spatialReference);
        const f2 = appStore.frames.map(f => f.spectralReference);
        const f3 = appStore.frames.map(f => f.rasterScalingReference);
        const currentSpectralReference = appStore.spectralReference;
        const currentSpatialReference = appStore.spatialReference;
        const currentRasterScalingReference = appStore.rasterScalingReference;
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
            currentRasterScalingReference
        ];

        return (
            <ResizeDetector onResize={this.onResize}>
                <div className="layer-list-widget">
                    {this.width > 0 && (
                        <Table2
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
                            getCellClipboardData={null}
                        >
                            <Column columnHeaderCellRenderer={this.columnHeaderRenderer} cellRenderer={this.fileNameRenderer} />
                            <Column columnHeaderCellRenderer={this.columnHeaderRenderer} cellRenderer={this.typeRenderer} />
                            <Column columnHeaderCellRenderer={this.columnHeaderRenderer} cellRenderer={this.matchingRenderer} />
                            <Column columnHeaderCellRenderer={this.columnHeaderRenderer} cellRenderer={this.channelRenderer} />
                            <Column columnHeaderCellRenderer={this.columnHeaderRenderer} cellRenderer={this.stokesRenderer} />
                        </Table2>
                    )}
                </div>
            </ResizeDetector>
        );
    }
}
