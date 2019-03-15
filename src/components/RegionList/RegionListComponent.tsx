import * as React from "react";
import {computed, observable} from "mobx";
import {observer} from "mobx-react";
import {HTMLTable, NonIdealState} from "@blueprintjs/core";
import ReactResizeDetector from "react-resize-detector";
import {CARTA} from "carta-protobuf";
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
            return (
                <div className="region-list-widget">
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"}/>;
                    <ReactResizeDetector handleWidth handleHeight onResize={this.onResize}/>
                </div>
            );
        }

        const padding = 5;
        const rowSize = 41;
        const requiredTableHeight = 1 + padding * 2 + rowSize * (this.validRegions.length + 1);
        const tableHeight = isFinite(this.height) ? Math.min(requiredTableHeight, this.height) : requiredTableHeight;

        let nameWidth = 160;
        const typeWidth = 90;
        const centerWidth = 120;
        const sizeWidth = 160;
        const rotationWidth = 80;

        const availableWidth = this.width - 2 * padding;
        const fixedWidth = typeWidth + centerWidth + sizeWidth + rotationWidth;
        if (availableWidth > fixedWidth) {
            nameWidth = availableWidth - fixedWidth;
        }
        const selectedRegion = frame.regionSet.selectedRegion;

        const rows = this.validRegions.map(region => {
            const point = region.controlPoints[0];
            let pixelCenterEntry;
            if (isFinite(point.x) && isFinite(point.y)) {
                pixelCenterEntry = <td style={{width: centerWidth}}>{`(${point.x.toFixed(0)}, ${point.y.toFixed(0)})`}</td>;
            } else {
                pixelCenterEntry = <td style={{width: centerWidth}}>Invalid</td>;
            }

            let pixelSizeEntry;
            if (region.regionType === CARTA.RegionType.RECTANGLE) {
                const sizePoint = region.controlPoints[1];
                pixelSizeEntry = <td style={{width: sizeWidth}}>{`(${sizePoint.x.toFixed(0)} \u00D7 ${sizePoint.y.toFixed(0)})`}</td>;
            } else if (region.regionType === CARTA.RegionType.ELLIPSE) {
                const sizePoint = region.controlPoints[1];
                pixelSizeEntry = <td style={{width: sizeWidth}}>{`maj: ${sizePoint.x.toFixed(0)}; min: ${sizePoint.y.toFixed(0)}`}</td>;
            } else {
                pixelSizeEntry = <td style={{width: sizeWidth}}/>;
            }

            return (
                <tr
                    className={(selectedRegion && selectedRegion.regionId === region.regionId) ? "selected" : ""}
                    key={region.regionId}
                    onClick={() => frame.regionSet.selectRegion(region)}
                    onDoubleClick={this.props.appStore.showRegionDialog}
                >
                    <td style={{width: nameWidth}}>{region.regionId === 0 ? "Cursor" : `Region ${region.regionId}`}</td>
                    <td style={{width: typeWidth}}>{RegionStore.RegionTypeString(region.regionType)}</td>
                    {pixelCenterEntry}
                    {pixelSizeEntry}
                    <td style={{width: rotationWidth}}>{region.rotation.toFixed(1)}</td>
                </tr>
            );
        });

        return (
            <div className="region-list-widget">
                <HTMLTable style={{height: tableHeight}}>
                    <thead className={this.props.appStore.darkTheme ? "dark-theme" : ""}>
                    <tr>
                        <th style={{width: nameWidth}}>Name</th>
                        <th style={{width: typeWidth}}>Type</th>
                        <th style={{width: centerWidth}}>Pixel Center</th>
                        <th style={{width: sizeWidth}}>Size</th>
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