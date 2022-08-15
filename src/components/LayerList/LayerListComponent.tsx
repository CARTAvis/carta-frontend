import * as React from "react";
import {CSSProperties} from "react";
import {action, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";
import {AnchorButton, Menu, MenuDivider, NonIdealState} from "@blueprintjs/core";
import {MenuItem2, Tooltip2} from "@blueprintjs/popover2";
import {Cell, Column, RowHeaderCell2, SelectionModes, Table2, IMenuContext, ColumnHeaderCell2} from "@blueprintjs/table";
import classNames from "classnames";
import ReactResizeDetector from "react-resize-detector";
import {DefaultWidgetConfig, WidgetProps, HelpType, AppStore} from "stores";
import {FrameStore} from "stores/Frame";
import {LayerListSettingsTabs} from "stores/widgets";
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
        const className = classNames("row-cell", {active: rowIndex === AppStore.Instance.activeFrameIndex});
        return <RowHeaderCell2 name={rowIndex.toString()} className={className} />;
    };

    private onFileSelected = (frame: FrameStore) => {
        AppStore.Instance.setActiveFrame(frame);
    };

    private fileNameRenderer = (rowIndex: number) => {
        const appStore = AppStore.Instance;
        if (rowIndex < 0 || rowIndex >= appStore.frames.length) {
            return <Cell />;
        }

        const frame = appStore.frames[rowIndex];
        const className = classNames("row-cell", {active: rowIndex === appStore.activeFrameIndex});

        return (
            <Cell className={className}>
                <React.Fragment>
                    <div className="name-cell" onClick={() => this.onFileSelected(frame)}>
                        {frame.filename}
                    </div>
                </React.Fragment>
            </Cell>
        );
    };

    private channelRenderer = (rowIndex: number) => {
        const appStore = AppStore.Instance;
        if (rowIndex < 0 || rowIndex >= appStore.frames.length) {
            return <Cell />;
        }
        const className = classNames("row-cell", {active: rowIndex === appStore.activeFrameIndex});
        return <Cell className={className}>{appStore.frames[rowIndex].requiredChannel}</Cell>;
    };

    private stokesRenderer = (rowIndex: number) => {
        const appStore = AppStore.Instance;
        if (rowIndex < 0 || rowIndex >= appStore.frames.length) {
            return <Cell />;
        }
        const className = classNames("row-cell", {active: rowIndex === appStore.activeFrameIndex});
        return <Cell className={className}>{appStore.frames[rowIndex].requiredPolarizationInfo}</Cell>;
    };

    private typeRenderer = (rowIndex: number) => {
        const appStore = AppStore.Instance;
        if (rowIndex < 0 || rowIndex >= appStore.frames.length) {
            return <Cell />;
        }

        const frame = appStore.frames[rowIndex];
        const className = classNames("row-cell", {active: rowIndex === appStore.activeFrameIndex});
        return (
            <Cell className={className}>
                <React.Fragment>
                    <Tooltip2
                        position={"bottom"}
                        content={
                            <span>
                                Raster layer
                                <br />
                                <i>
                                    <small>Click to {frame.renderConfig.visible ? "hide" : "show"}</small>
                                </i>
                            </span>
                        }
                    >
                        <AnchorButton minimal={true} small={true} active={frame.renderConfig.visible} intent={frame.renderConfig.visible ? "success" : "none"} onClick={frame.renderConfig.toggleVisibility}>
                            R
                        </AnchorButton>
                    </Tooltip2>
                    {frame.contourConfig.enabled && (
                        <Tooltip2
                            position={"bottom"}
                            content={
                                <span>
                                    Contour layer
                                    <br />
                                    <i>
                                        <small>Click to {frame.contourConfig.visible ? "hide" : "show"}</small>
                                    </i>
                                </span>
                            }
                        >
                            <AnchorButton minimal={true} small={true} active={frame.contourConfig.visible} intent={frame.contourConfig.visible ? "success" : "none"} onClick={frame.contourConfig.toggleVisibility}>
                                C
                            </AnchorButton>
                        </Tooltip2>
                    )}
                    {frame.vectorOverlayConfig.enabled && (
                        <Tooltip2
                            position={"bottom"}
                            content={
                                <span>
                                    Vector overlay layer
                                    <br />
                                    <i>
                                        <small>Click to {frame.vectorOverlayConfig.visible ? "hide" : "show"}</small>
                                    </i>
                                </span>
                            }
                        >
                            <AnchorButton minimal={true} small={true} active={frame.vectorOverlayConfig.visible} intent={frame.vectorOverlayConfig.visible ? "success" : "none"} onClick={frame.vectorOverlayConfig.toggleVisibility}>
                                V
                            </AnchorButton>
                        </Tooltip2>
                    )}
                </React.Fragment>
            </Cell>
        );
    };

    private matchingRenderer = (rowIndex: number) => {
        const appStore = AppStore.Instance;
        if (rowIndex < 0 || rowIndex >= appStore.frames.length) {
            return <Cell />;
        }

        const frame = appStore.frames[rowIndex];

        let spatialMatchingButton: React.ReactNode;
        if (appStore.spatialReference) {
            let tooltipSubtitle: string;
            if (frame === appStore.spatialReference) {
                tooltipSubtitle = `${frame.filename} is the current spatial reference`;
            } else {
                tooltipSubtitle = `Click to ${frame.spatialReference ? "disable" : "enable"} matching to ${appStore.spatialReference.filename}`;
            }
            spatialMatchingButton = (
                <Tooltip2
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
                    >
                        XY
                    </AnchorButton>
                </Tooltip2>
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
                <Tooltip2
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
                    >
                        Z
                    </AnchorButton>
                </Tooltip2>
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
                <Tooltip2
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
                </Tooltip2>
            );
        }

        const className = classNames("row-cell", {active: rowIndex === appStore.activeFrameIndex});
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

        return <ColumnHeaderCell2 name={name} style={columnHeaderStyleProps} />;
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

    private contextMenuRenderer = (context: IMenuContext) => {
        const rows = context.getTarget().rows;
        const appStore = AppStore.Instance;
        if (rows && rows.length && appStore.frames[rows[0]]) {
            const frame = appStore.frames[rows[0]];
            if (frame) {
                return (
                    <Menu>
                        <MenuDivider title={frame.filename} />
                        <MenuItem2 disabled={appStore.spatialReference === frame} text="Set as spatial reference" onClick={() => appStore.setSpatialReference(frame)} />
                        <MenuItem2 disabled={appStore.spectralReference === frame || frame.frameInfo.fileInfoExtended.depth <= 1} text="Set as spectral reference" onClick={() => appStore.setSpectralReference(frame)} />
                        <MenuItem2 disabled={appStore.rasterScalingReference === frame} text="Set as raster scaling reference" onClick={() => appStore.setRasterScalingReference(frame)} />
                        <MenuDivider />
                        <MenuItem2 disabled={!frame.isRestFreqEditable} text="Set rest frequency" onClick={() => this.restFreqShortCutOnClick(rows[0])} />
                        <MenuDivider />
                        <MenuItem2 text="Close image" onClick={() => appStore.closeFile(frame)} />
                        <MenuItem2 text="Close other images" disabled={appStore.frames?.length <= 1} onClick={() => appStore.closeOtherFiles(frame)} />
                        <MenuItem2 text="Close all images" disabled={appStore.frames?.length <= 1} onClick={() => appStore.closeOtherFiles(null, false)} />
                    </Menu>
                );
            }
        }
        return null;
    };

    render() {
        const appStore = AppStore.Instance;
        const frameNum = appStore.frameNum;

        if (frameNum <= 0) {
            return (
                <div className="layer-list-widget">
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />;<ReactResizeDetector handleWidth handleHeight onResize={this.onResize}></ReactResizeDetector>
                </div>
            );
        }

        // This is a necessary hack in order to trigger a re-rendering when values change, because the cell renderer is in its own function
        // There is probably a neater way to do this, though
        /* eslint-disable @typescript-eslint/no-unused-vars */
        const frameChannels = appStore.frameChannels;
        const frameStokes = appStore.frameStokes;
        const activeFrameIndex = appStore.activeFrameIndex;
        const visibilityRaster = appStore.frames.map(f => f.renderConfig.visible);
        const visibilityContour = appStore.frames.map(f => f.contourConfig.visible && f.contourConfig.enabled);
        const visibilityOverlay = appStore.frames.map(f => f.vectorOverlayConfig.visible && f.vectorOverlayConfig.enabled);
        const f1 = appStore.frames.map(f => f.spatialReference);
        const f2 = appStore.frames.map(f => f.spectralReference);
        const f3 = appStore.frames.map(f => f.rasterScalingReference);
        const currentSpectralReference = appStore.spectralReference;
        const currentSpatialReference = appStore.spatialReference;
        const currentRasterScalingReference = appStore.rasterScalingReference;

        /* eslint-enable @typescript-eslint/no-unused-vars */
        return (
            <div className="layer-list-widget">
                {this.width > 0 && (
                    <Table2
                        numRows={frameNum}
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
                    >
                        <Column columnHeaderCellRenderer={this.columnHeaderRenderer} cellRenderer={this.fileNameRenderer} />
                        <Column columnHeaderCellRenderer={this.columnHeaderRenderer} cellRenderer={this.typeRenderer} />
                        <Column columnHeaderCellRenderer={this.columnHeaderRenderer} cellRenderer={this.matchingRenderer} />
                        <Column columnHeaderCellRenderer={this.columnHeaderRenderer} cellRenderer={this.channelRenderer} />
                        <Column columnHeaderCellRenderer={this.columnHeaderRenderer} cellRenderer={this.stokesRenderer} />
                    </Table2>
                )}
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize}></ReactResizeDetector>
            </div>
        );
    }
}
