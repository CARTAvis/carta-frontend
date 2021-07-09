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
        const frameNum = appStore.frames.length;
        const frame = appStore.activeFrame;

        if (frameNum <= 0) {
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
            new CARTA.CatalogHeader({name: "XY (World)", dataType, columnIndex: 2}),
            new CARTA.CatalogHeader({name: "XY (Image)", dataType, columnIndex: 3}),
            new CARTA.CatalogHeader({name: "Z", dataType, columnIndex: 4})
        ];

        let imageNames = appStore.frames.map(frame => frame.filename);
        let values = Array(frameNum).fill("-");
        let worldCoords = Array(frameNum).fill("-");
        let imageCoords = Array(frameNum).fill("-");
        let zCoords = Array(frameNum).fill("-");

        const activeFrameIndex = appStore.activeFrameIndex;
        if (frame.cursorInfo.isInsideImage) {
            values[activeFrameIndex] = frame.cursorValueString;
        }
        worldCoords[activeFrameIndex] = (
            <React.Fragment>
                {frame.cursorInfo?.infoWCS?.x}
                <br />
                {frame.cursorInfo?.infoWCS?.y}
            </React.Fragment>
        );
        imageCoords[activeFrameIndex] = (
            <React.Fragment>
                {toFixed(frame.cursorInfo?.posImageSpace?.x, 3)}
                <br />
                {toFixed(frame.cursorInfo?.posImageSpace?.y, 3)}
            </React.Fragment>
        );
        let zCoordString = [];
        if (frame.spectralInfo?.spectralString) {
            zCoordString.push(frame.spectralInfo.spectralString.replace(/\w+\s\(/, "")?.replace(/\):\s/, "\u000A"));
            if (frame.spectralInfo.freqString) {
                zCoordString.push(<br key={0} />);
                zCoordString.push(frame.spectralInfo.freqString.replace(/\w+:\s/, "\u000A"));
            }
            if (frame.spectralInfo.velocityString) {
                zCoordString.push(<br key={1} />);
                zCoordString.push(frame.spectralInfo.velocityString.replace(/\w+:\s/, "\u000A"));
            }
        } else {
            zCoordString.push("NaN");
        }
        zCoords[activeFrameIndex] = (
            <React.Fragment>{zCoordString}</React.Fragment>
        );

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
