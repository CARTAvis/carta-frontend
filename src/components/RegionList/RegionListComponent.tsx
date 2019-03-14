import * as React from "react";
import {computed, observable} from "mobx";
import {observer} from "mobx-react";
import {HTMLTable, NonIdealState} from "@blueprintjs/core";
import ReactResizeDetector from "react-resize-detector";
import {RegionStore, WidgetConfig, WidgetProps} from "stores";
import "./RegionListComponent.css";
import {min} from "rxjs/operators";

@observer
export class RegionListComponent extends React.Component<WidgetProps> {
    @computed get validRegions(): RegionStore[] {
        if (this.props.appStore.activeFrame) {
            return this.props.appStore.activeFrame.regionSet.regions.filter(r => !r.isTemporary);
        }
        return [];
    }

    @observable width: number;
    @observable height: number;

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

    private onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    render() {
        const frame = this.props.appStore.activeFrame;

        if (!frame) {
            return <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"}/>;
        }

        const padding = 5;
        const rowSize = 41;
        const requiredTableHeight = 1 + padding * 2 + rowSize * (this.validRegions.length + 1);
        const tableHeight = Math.min(requiredTableHeight, this.height);

        let nameWidth = 160;
        const typeWidth = 100;
        const centerWidth = 120;
        const rotationWidth = 80;

        const availableWidth = this.width - 2 * padding;
        const fixedWidth = typeWidth + centerWidth + rotationWidth;
        nameWidth = availableWidth - fixedWidth;
        const selectedRegion = frame.regionSet.selectedRegion;

        const rows = this.validRegions.map(region => {
            const point = region.controlPoints[0];
            let pixelCenterEntry;
            if (isFinite(point.x) && isFinite(point.y)) {
                pixelCenterEntry = <td style={{width: centerWidth}}>{`(${point.x.toFixed(0)}, ${point.y.toFixed(0)})`}</td>;
            } else {
                pixelCenterEntry = <td style={{width: centerWidth}}>Invalid</td>;
            }
            return (
                <tr
                    className={(selectedRegion && selectedRegion.regionId === region.regionId) ? "selected" : ""}
                    key={region.regionId}
                    onClick={() => frame.regionSet.selectRegion(region)}
                >
                    <td style={{width: nameWidth}}>{region.regionId === 0 ? "Cursor" : `Region ${region.regionId}`}</td>
                    <td style={{width: typeWidth}}>{RegionStore.RegionTypeString(region.regionType)}</td>
                    {pixelCenterEntry}
                    <td style={{width: rotationWidth}}>{region.rotation.toFixed(1)}</td>
                </tr>
            );
        });

        return (
            <div className="region-list-widget">
                <HTMLTable style={{height: tableHeight}}>
                    <thead>
                    <tr>
                        <th style={{width: nameWidth}}>Name</th>
                        <th style={{width: typeWidth}}>Type</th>
                        <th style={{width: centerWidth}}>Pixel Center</th>
                        <th style={{width: rotationWidth}}>Rotation</th>
                    </tr>
                    </thead>
                    <tbody className={this.props.appStore.darkTheme ? "dark-theme" : ""}>
                    {rows}
                    </tbody>
                </HTMLTable>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize}/>
            </div>
        );
    }
}