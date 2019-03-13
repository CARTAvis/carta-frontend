import * as React from "react";
import {computed} from "mobx";
import {observer} from "mobx-react";
import {NonIdealState} from "@blueprintjs/core";
import {Cell, Column, IRegion, RenderMode, SelectionModes, Table} from "@blueprintjs/table";
import {RegionStore, WidgetConfig, WidgetProps} from "stores";
import "./RegionListComponent.css";

@observer
export class RegionListComponent extends React.Component<WidgetProps> {
    @computed get validRegions(): RegionStore[] {
        if (this.props.appStore.activeFrame) {
            return this.props.appStore.activeFrame.regionSet.regions.filter(r => !r.isTemporary);
        }
        return [];
    }

    @computed get selectedRow(): IRegion[] {
        const frame = this.props.appStore.activeFrame;
        if (frame && frame.regionSet.selectedRegion) {
            const index = frame.regionSet.regions.indexOf(frame.regionSet.selectedRegion);
            return [{rows: [index, index]}];
        }
        return [];
    }

    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "region-list",
            type: "region-list",
            minWidth: 350,
            minHeight: 180,
            defaultWidth: 650,
            defaultHeight: 180,
            title: "Region List",
            isCloseable: true
        };
    }

    private renderName = (rowIndex: number) => {
        const region = this.validRegions[rowIndex];
        return <Cell className={region.editing ? "region-editing" : ""}>{region.regionId === 0 ? "Cursor" : `Region ${region.regionId}`}</Cell>;
    };

    private renderType = (rowIndex: number) => {
        const region = this.validRegions[rowIndex];
        return <Cell className={region.editing ? "region-editing" : ""}>{RegionStore.RegionTypeString(region.regionType)}</Cell>;
    };

    private renderCenter = (rowIndex: number) => {
        const region = this.validRegions[rowIndex];
        if (region.controlPoints.length) {
            const point = region.controlPoints[0];
            if (isFinite(point.x) && isFinite(point.y)) {
                return <Cell className={region.editing ? "region-editing" : ""}>{`(${point.x.toFixed(0)}, ${point.y.toFixed(0)})`}</Cell>;
            }
        }
        return <Cell>Invalid</Cell>;
    };

    private renderRotation = (rowIndex: number) => {
        const region = this.validRegions[rowIndex];
        return <Cell className={region.editing ? "region-editing" : ""}>{region.rotation.toFixed(1)}</Cell>;
    };

    private handleSelection = (selectedRegions: IRegion[]) => {
        const frame = this.props.appStore.activeFrame;
        if (frame && frame.regionSet.regions.length && selectedRegions.length) {
            frame.regionSet.selectRegionByIndex(selectedRegions[0].rows[0]);
        }
    };

    render() {
        const frame = this.props.appStore.activeFrame;

        if (!frame) {
            return <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"}/>;
        }

        // dummy
        const x = this.validRegions.map(r => r.controlPoints.length);
        const y = this.validRegions.map(r => r.rotation);

        return (
            <div className="region-list-widget">
                <Table
                    numRows={this.validRegions.length}
                    defaultRowHeight={25}
                    selectionModes={SelectionModes.ROWS_AND_CELLS}
                    onSelection={this.handleSelection}
                    selectedRegions={this.selectedRow}
                    enableMultipleSelection={false}
                    enableRowHeader={false}
                    renderMode={RenderMode.NONE}
                >
                    <Column name="Name" cellRenderer={this.renderName}/>
                    <Column name="Type" cellRenderer={this.renderType}/>
                    <Column name="Pixel Center" cellRenderer={this.renderCenter}/>
                    <Column name="Rotation (Deg)" cellRenderer={this.renderRotation}/>
                </Table>
            </div>
        );
    }
}