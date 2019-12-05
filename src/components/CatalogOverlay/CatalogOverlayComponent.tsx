import * as React from "react";
import * as _ from "lodash";
import {autorun, computed, observable} from "mobx";
import {observer} from "mobx-react";
import {Colors, NonIdealState} from "@blueprintjs/core";
import {Cell, Column, Table, Utils} from "@blueprintjs/table";
import ReactResizeDetector from "react-resize-detector";
import {ChartArea} from "chart.js";
import {CARTA} from "carta-protobuf";
import {LinePlotComponent, LinePlotComponentProps, ScatterPlotComponent, ScatterPlotComponentProps, VERTICAL_RANGE_PADDING, PlotType} from "components/Shared";
import {AnimationState, WidgetConfig, WidgetProps} from "stores";
import {CatalogOverlayWidgetStore, StokesCoordinate} from "stores/widgets";
import {ChannelInfo, Point2D} from "models";
import {clamp, normalising, polarizationAngle, polarizedIntensity, binarySearchByX, closestPointIndexToCursor, toFixed, minMaxPointArrayZ} from "utilities";

@observer
export class CatalogOverlayComponent extends React.Component<WidgetProps> {

    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "catalog-overlay",
            type: "catalog-overlay",
            minWidth: 320,
            minHeight: 400,
            defaultWidth: 400,
            defaultHeight: 650,
            title: "Catalog Overlay",
            isCloseable: true
        };
    }

    @observable width: number;
    @observable height: number;

    @computed get widgetStore(): CatalogOverlayWidgetStore {
        if (this.props.appStore && this.props.appStore.widgetsStore.catalogOverlayWidgets) {
            const widgetStore = this.props.appStore.widgetsStore.catalogOverlayWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return new CatalogOverlayWidgetStore();
    }

    // @computed get profileStore(): SpectralProfileStore {
    //     if (this.props.appStore && this.props.appStore.activeFrame) {
    //         let fileId = this.props.appStore.activeFrame.frameInfo.fileId;
    //         const regionId = this.widgetStore.regionIdMap.get(fileId) || 0;
    //         const frameMap = this.props.appStore.spectralProfiles.get(fileId);
    //         if (frameMap) {
    //             return frameMap.get(regionId);
    //         }
    //     }
    //     return null;
    // }

    constructor(props: WidgetProps) {
        super(props);
        if (!props.docked && props.id === CatalogOverlayComponent.WIDGET_CONFIG.type) {
            const id = props.appStore.widgetsStore.addCatalogOverlayWidget();
            props.appStore.widgetsStore.changeWidgetId(props.id, id);
        } else {
            if (!this.props.appStore.widgetsStore.catalogOverlayWidgets.has(this.props.id)) {
                console.log(`can't find store for widget with id=${this.props.id}`);
                this.props.appStore.widgetsStore.catalogOverlayWidgets.set(this.props.id, new CatalogOverlayWidgetStore());
            }
        }

        // autorun(() => {
        //     if (this.widgetStore) {
        //         const appStore = this.props.appStore;
        //         const frame = appStore.activeFrame;
        //         if (frame) {
        //             const regionId = this.widgetStore.regionIdMap.get(frame.frameInfo.fileId) || 0;
        //             const regionString = regionId === 0 ? "Cursor" : `Region #${regionId}`;
        //             const selectedString = this.matchesSelectedRegion ? "(Selected)" : "";
        //             this.props.appStore.widgetsStore.setWidgetTitle(this.props.id, `Stokes Analysis : ${regionString} ${selectedString} ${progressString}`);
        //         }
        //     } else {
        //         this.props.appStore.widgetsStore.setWidgetTitle(this.props.id, `Stokes Analysis: Cursor`);
        //     }
        // });
    }

    // REORDERABLE_TABLE_DATA = [
    //     ["A", "Apple", "Ape", "Albania", "Anchorage"],
    //     ["B", "Banana", "Boa", "Brazil", "Boston"],
    //     ["C", "Cranberry", "Cougar", "Croatia", "Chicago"],
    //     ["D", "Dragonfruit", "Deer", "Denmark", "Denver"],
    //     ["E", "Eggplant", "Elk", "Eritrea", "El Paso"],
    // ].map(([letter, fruit, animal, country, city]) => ({ letter, fruit, animal, country, city }));

    // col = {columns : [
    //     // these cellRenderers are only created once and then cloned on updates
    //     <Column key="1" name="Letter" cellRenderer={this.getCellRenderer("letter")} />,
    //     <Column key="2" name="Fruit" cellRenderer={this.getCellRenderer("fruit")} />,
    //     <Column key="3" name="Animal" cellRenderer={this.getCellRenderer("animal")} />,
    //     <Column key="4" name="Country" cellRenderer={this.getCellRenderer("country")} />,
    //     <Column key="5" name="City" cellRenderer={this.getCellRenderer("city")} />,
    // ],
    // data: this.REORDERABLE_TABLE_DATA,
    // enableColumnInteractionBar: false,
    // };

    // private getCellRenderer(key: string) {
    //     return (row: number) => <Cell>{this.REORDERABLE_TABLE_DATA[row][key]}</Cell>;
    // }

    render() {
        const widgetStore = this.widgetStore;
        const catalogHeader = widgetStore.catalogFackHeader;
        const catalogData = widgetStore.catalogFackData;

        const cellRenderer = rowIndex => {
            return <Cell>{`$${(rowIndex * 10).toFixed(2)}`}</Cell>;
        };

        const infiniteLoad = ({ rowIndexEnd }) => rowIndexEnd + 1 >= 50;

        const columnHeader = 0;
        return (
            <div className={"catalog-overlay"}>
                <p>Catalog Overlay</p>
                <div className = "catalog-overlay-column-header">
                <Table numRows={50} onVisibleCellsChange={infiniteLoad}>
                    <Column name="Dollars" cellRenderer={cellRenderer} />
                </Table>
                </div>
            </div>
        );
    }

}