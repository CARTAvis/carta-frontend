import * as React from "react";
import {observer} from "mobx-react";
import {NonIdealState} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {SimpleTableComponent} from "components/Shared";
import {formattedExponential, toFixed} from "utilities";
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
            isCloseable: true,
        };
    }

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

        const columnWidths = [90, 140, 125, 125, 128]

        const dataType = CARTA.ColumnType.String;
        const columnHeaders = [
            new CARTA.CatalogHeader({name: "Image", dataType, columnIndex: 0}),
            new CARTA.CatalogHeader({name: "Value", dataType, columnIndex: 1}),
            new CARTA.CatalogHeader({name: "XY World Coord.", dataType, columnIndex: 2}),
            new CARTA.CatalogHeader({name: "XY Image Coord.", dataType, columnIndex: 3}),
            new CARTA.CatalogHeader({name: "Z Coord.", dataType, columnIndex: 4})
        ];

        const imageNames = appStore.frames.map(frame => frame.filename);
        const values = appStore.frames.map(frame => {
            const isValueCurrent = frame.isCursorValueCurrent ? "" : "*";
            const value = frame.cursorInfo?.isInsideImage ? frame.cursorValue.value : undefined;
            if (isNaN(value)) {
                return "NaN" + isValueCurrent;
            } else {
                return formattedExponential(value, 5, frame.unit, true, true) + isValueCurrent;
            }
        });
        const worldCoords = appStore.frames.map(frame => <React.Fragment>{frame.cursorInfo?.infoWCS?.x}<br />{frame.cursorInfo?.infoWCS?.y}</React.Fragment>);
        const imageCoords = appStore.frames.map(frame => <React.Fragment>{toFixed(frame.cursorInfo?.posImageSpace?.x, 3)}<br />{toFixed(frame.cursorInfo?.posImageSpace?.y, 3)}</React.Fragment>);
        const zCoords = appStore.frames.map(frame => {
            return <React.Fragment>{frame.simpleSpectralInfo}</React.Fragment>;
        });

        let columnsData = new Map<number, any>();
        columnsData.set(0, {dataType, data: imageNames});
        columnsData.set(1, {dataType, data: values});
        columnsData.set(2, {dataType, data: worldCoords});
        columnsData.set(3, {dataType, data: imageCoords});
        columnsData.set(4, {dataType, data: zCoords});

        return (
            <div className="cursor-info-widget">
                <SimpleTableComponent
                    dataset={columnsData}
                    columnHeaders={columnHeaders}
                    numVisibleRows={appStore.frames.length}
                    defaultColumnWidths={columnWidths}
                    enableGhostCells={false}
                    defaultRowHeight={40}
                    isIndexZero={true}
                />
            </div>
        );
    }
}