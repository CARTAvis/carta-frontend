import * as React from "react";
import {observer} from "mobx-react";
import {action, makeObservable, observable} from "mobx";
import {NonIdealState} from "@blueprintjs/core";
import ReactResizeDetector from "react-resize-detector";
import {CARTA} from "carta-protobuf";
import {SimpleTableComponent} from "components/Shared";
import {formattedExponential, toFixed} from "utilities";
import {AppStore, DefaultWidgetConfig, HelpType, WidgetProps} from "stores";
import {FrameStore} from "stores/Frame";
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

    private columnWidths: number[] = [90, 95, 50, 95, 95, 128, 70, 95];

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

    private genValueContent = (frame: FrameStore): React.ReactNode => {
        if (!frame?.cursorInfo?.isInsideImage || frame?.cursorValue === undefined) {
            return "-";
        }

        let valueString = formattedExponential(frame.cursorValue.value, 5, "", true, true);
        if (isNaN(frame.cursorValue.value)) {
            valueString = "NaN";
        }
        if (!frame.isCursorValueCurrent) {
            valueString += "*";
        }
        return frame.unit === undefined || !frame.unit.length ? (
            valueString
        ) : (
            <React.Fragment>
                {valueString}
                <br />
                {frame.unit}
            </React.Fragment>
        );
    };

    private genWorldCoordContent = (frame: FrameStore): React.ReactNode => {
        const infoWCS = frame?.cursorInfo?.infoWCS;
        if (!infoWCS) {
            return "-";
        }

        return (
            <React.Fragment>
                {infoWCS.x}
                <br />
                {infoWCS.y}
            </React.Fragment>
        );
    };

    private genImageCoordContent = (frame: FrameStore): React.ReactNode => {
        const x = frame?.cursorInfo?.posImageSpace?.x;
        const y = frame?.cursorInfo?.posImageSpace?.y;
        if (!isFinite(x) || !isFinite(y) || (x === -Number.MAX_VALUE && y === -Number.MAX_VALUE)) {
            return "-";
        }

        return (
            <React.Fragment>
                {toFixed(x, 3)}
                <br />
                {toFixed(y, 3)}
            </React.Fragment>
        );
    };

    private genZCoordContent = (frame: FrameStore): React.ReactNode => {
        if (frame?.spectralInfo?.spectralString) {
            let zCoordString = [];
            zCoordString.push(frame.spectralInfo.spectralString.replace(/\w+\s\(/, "")?.replace(/\):\s/, "\u000A"));
            if (frame.spectralInfo.freqString) {
                zCoordString.push(<br key={0} />);
                zCoordString.push(frame.spectralInfo.freqString.replace(/\w+:\s/, "\u000A"));
            }
            if (frame.spectralInfo.velocityString) {
                zCoordString.push(<br key={1} />);
                zCoordString.push(frame.spectralInfo.velocityString.replace(/\w+:\s/, "\u000A"));
            }
            return <React.Fragment>{zCoordString}</React.Fragment>;
        } else {
            return "NaN";
        }
    };

    render() {
        const appStore = AppStore.Instance;
        const frameNum = appStore.frames.length;
        const frame = appStore.hoveredFrame ?? appStore.activeFrame;

        if (frameNum <= 0) {
            return (
                <div className="region-list-widget">
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />
                </div>
            );
        }

        const columnNames = ["Image", "Value", "WCS", "XY (World)", "XY (Image)", "Z", "Channel", "Polarization"];
        const dataType = CARTA.ColumnType.String;
        const columnHeaders = columnNames.map((name, index) => new CARTA.CatalogHeader({name: name, dataType, columnIndex: index}));

        const imageNames = appStore.frames.map(frame => frame.filename);
        let values = Array(frameNum).fill("-");
        let systems = Array(frameNum).fill("-");
        let worldCoords = Array(frameNum).fill("-");
        let imageCoords = Array(frameNum).fill("-");
        const zCoords = appStore.frames.map(frame => this.genZCoordContent(frame));
        const channels = appStore.frames.map(frame => frame.requiredChannel);
        const stokes = appStore.frames.map(frame => frame.requiredStokesInfo);

        const showFrames = frame.spatialReference ? [frame.spatialReference, ...frame.spatialReference.secondarySpatialImages] : [frame, ...frame.secondarySpatialImages];
        const showFileIds = showFrames.map(frame => frame.frameInfo.fileId);
        appStore.frames.forEach((frame, index) => {
            if (showFileIds.includes(frame.frameInfo.fileId)) {
                values[index] = this.genValueContent(frame);
                systems[index] = appStore.overlayStore.global.explicitSystem ?? "-";
                worldCoords[index] = this.genWorldCoordContent(frame);
                imageCoords[index] = this.genImageCoordContent(frame);
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
