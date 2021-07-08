import * as React from "react";
import {observer} from "mobx-react";
import {action, makeObservable, observable} from "mobx";
import {NonIdealState} from "@blueprintjs/core";
import ReactResizeDetector from "react-resize-detector";
import {CARTA} from "carta-protobuf";
import {SimpleTableComponent} from "components/Shared";
import {toFixed} from "utilities";
import {AppStore, DefaultWidgetConfig, WidgetProps} from "stores";
import "./CursorInfoComponent.scss";

@observer
export class CursorInfoComponent extends React.Component<WidgetProps> {
    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "cursor-info",
            type: "cursor-info",
            minWidth: 350,
            minHeight: 180,
            defaultWidth: 650,
            defaultHeight: 180,
            title: "Cursor Information",
            isCloseable: true
        };
    }

    @observable width: number = 0;
    @observable height: number = 0;

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    @action private onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    render() {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;

        if (!frame) {
            return (
                <div className="region-list-widget">
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />
                </div>
            );
        }

        const columnWidths = [90, 140, 125, 125, 128];

        const dataType = CARTA.ColumnType.String;
        const columnHeaders = [
            new CARTA.CatalogHeader({name: "Image", dataType, columnIndex: 0}),
            new CARTA.CatalogHeader({name: "Value", dataType, columnIndex: 1}),
            new CARTA.CatalogHeader({name: "XY World Coord.", dataType, columnIndex: 2}),
            new CARTA.CatalogHeader({name: "XY Image Coord.", dataType, columnIndex: 3}),
            new CARTA.CatalogHeader({name: "Z Coord.", dataType, columnIndex: 4})
        ];

        const imageNames = appStore.frames.map(frame => frame.filename);
        const values = appStore.frames.map(frame => frame.cursorValueString);
        const worldCoords = appStore.frames.map(frame => (
            <React.Fragment>
                {frame.cursorInfo?.infoWCS?.x}
                <br />
                {frame.cursorInfo?.infoWCS?.y}
            </React.Fragment>
        ));
        const imageCoords = appStore.frames.map(frame => (
            <React.Fragment>
                {toFixed(frame.cursorInfo?.posImageSpace?.x, 3)}
                <br />
                {toFixed(frame.cursorInfo?.posImageSpace?.y, 3)}
            </React.Fragment>
        ));
        const zCoords = appStore.frames.map(frame => {
            let zCoordString = [];
            if (frame.spectralInfo?.spectralString) {
                zCoordString.push(frame.spectralInfo.spectralString.replace(/.*: /, ""));
                if (frame.spectralInfo.freqString) {
                    zCoordString.push(<br key={0} />);
                    zCoordString.push(frame.spectralInfo.freqString.replace(/.*: /, ""));
                }
                if (frame.spectralInfo.velocityString) {
                    zCoordString.push(<br key={1} />);
                    zCoordString.push(frame.spectralInfo.velocityString.replace(/.*: /, ""));
                }
            } else {
                zCoordString.push("NaN");
            }
            return <React.Fragment>{zCoordString}</React.Fragment>;
        });

        let columnsData = new Map<number, any>();
        columnsData.set(0, {dataType, data: imageNames});
        columnsData.set(1, {dataType, data: values});
        columnsData.set(2, {dataType, data: worldCoords});
        columnsData.set(3, {dataType, data: imageCoords});
        columnsData.set(4, {dataType, data: zCoords});

        return (
            <div className="cursor-info-widget">
                {this.width > 0 && ( // prevent row index header not rendering
                    <SimpleTableComponent dataset={columnsData} columnHeaders={columnHeaders} numVisibleRows={appStore.frames.length} defaultColumnWidths={columnWidths} enableGhostCells={false} defaultRowHeight={40} isIndexZero={true} />
                )}
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize}></ReactResizeDetector>
            </div>
        );
    }
}
