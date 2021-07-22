import * as React from "react";
import {observer} from "mobx-react";
import {action, makeObservable, observable} from "mobx";
import {NonIdealState} from "@blueprintjs/core";
import ReactResizeDetector from "react-resize-detector";
import {CARTA} from "carta-protobuf";
import {SimpleTableComponent} from "components/Shared";
import {formattedExponential, toFixed} from "utilities";
import {AppStore, DefaultWidgetConfig, FrameStore, HelpType, WidgetProps} from "stores";
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
            title: "Cursor Info",
            isCloseable: true,
            helpType: HelpType.PLACEHOLDER
        };
    }

    private columnWidths: number[] = [90, 95, 50, 95, 95, 128, 70, 70];

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

    private onColumnWidthChanged = (index: number, size: number) => {
        if (!Number.isInteger(index) || index < 0 || index >= this.columnWidths.length || size <= 0) {
            return;
        }
        this.columnWidths[index] = size;
    };

    private genZCoordString = (frame: FrameStore): Array<any> => {
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
        return zCoordString;
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

        const columnNames = ["Image", "Value", "WCS", "XY (World)", "XY (Image)", "Z", "Channel", "Stokes"];
        const dataType = CARTA.ColumnType.String;
        const columnHeaders = columnNames.map((name, index) => new CARTA.CatalogHeader({name: name, dataType, columnIndex: index}));

        let imageNames: any = appStore.frames.map(frame => frame.filename);
        let values: any = Array(frameNum).fill("-");
        let systems: any = Array(frameNum).fill("-");
        let worldCoords: any = Array(frameNum).fill("-");
        let imageCoords: any = Array(frameNum).fill("-");
        let zCoords: any = appStore.frames.map(frame => this.genZCoordString(frame));
        let channels: any = appStore.frames.map(frame => frame.requiredChannel);
        let stokes: any = appStore.frames.map(frame => frame.requiredStokes);
        
        const showFrames = frame.spatialReference ? [frame.spatialReference, ...frame.spatialReference.secondarySpatialImages] : [frame, ...frame.secondarySpatialImages];
        const showFileIds = showFrames.map(frame => frame.frameInfo.fileId);
        appStore.frames.forEach((frame, index) => {
            if (showFileIds.includes(frame.frameInfo.fileId)) {
                if (frame.cursorInfo.isInsideImage && frame.cursorValue !== undefined) {
                    let valueString = formattedExponential(frame.cursorValue.value, 5, "", true, true);
                    if (isNaN(frame.cursorValue.value)) {
                        valueString = "NaN";
                    }
                    if (!frame.isCursorValueCurrent) {
                        valueString += "*";
                    }
                    values[index] =
                        frame.unit === undefined || !frame.unit.length ? (
                            valueString
                        ) : (
                            <React.Fragment>
                                {valueString}
                                <br />
                                {frame.unit}
                            </React.Fragment>
                        );
                }
                systems[index] = appStore.overlayStore.global.explicitSystem;
                if (frame.cursorInfo?.infoWCS) {
                    worldCoords[index] = (
                        <React.Fragment>
                            {frame.cursorInfo.infoWCS.x}
                            <br />
                            {frame.cursorInfo.infoWCS.y}
                        </React.Fragment>
                    );
                }
                imageCoords[index] = (
                    <React.Fragment>
                        {toFixed(frame.cursorInfo?.posImageSpace?.x, 3)}
                        <br />
                        {toFixed(frame.cursorInfo?.posImageSpace?.y, 3)}
                    </React.Fragment>
                );
            }
        });

        const columnsData = new Map<number, any>([
            [0, {dataType, data: imageNames}],
            [1, {dataType, data: values}],
            [2, {dataType, data: systems}],
            [3, {dataType, data: worldCoords}],
            [4, {dataType, data: imageCoords}],
            [5, {dataType, data: zCoords}],
            [6, {dataType, data: channels}],
            [7, {dataType, data: stokes}]
        ]);

        return (
            <div className="cursor-info-widget">
                {this.width > 0 && ( // prevent row index header not rendering
                    <SimpleTableComponent
                        dataset={columnsData}
                        columnHeaders={columnHeaders}
                        numVisibleRows={appStore.frames.length}
                        columnWidths={this.columnWidths}
                        onColumnWidthChanged={this.onColumnWidthChanged}
                        enableGhostCells={false}
                        defaultRowHeight={40}
                        isIndexZero={true}
                        boldIndex={[appStore.activeFrameIndex]}
                    />
                )}
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize}></ReactResizeDetector>
            </div>
        );
    }
}
