import * as React from "react";
import {ColorResult} from "react-color";
import {Classes, FormGroup, IDialogProps, NonIdealState, Tab, Tabs} from "@blueprintjs/core";
import * as AST from "ast_wrapper";
import {action, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {ImageViewLayer} from "components";
import {DraggableDialogComponent} from "components/Dialogs";
import {ColorPickerComponent, CoordinateComponent, CoordNumericInput, InputType, SafeNumericInput} from "components/Shared";
import {CustomIcon} from "icons/CustomIcons";
import {Point2D, WCSPoint2D} from "models";
import {AppStore, DialogId, DialogStore, HelpType} from "stores";
import {CoordinateMode, DistanceMeasuringStore} from "stores/Frame";
import {getFormattedWCSPoint, getPixelValueFromWCS, isWCSStringFormatValid, SWATCH_COLORS} from "utilities";

import "./DistanceMeasuringDialog.scss";

enum DistanceMeasuringDialogTabs {
    Configuration,
    Styling
}

@observer
export class DistanceMeasuringDialog extends React.Component {

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    @observable selectedTab: DistanceMeasuringDialogTabs = DistanceMeasuringDialogTabs.Configuration;
    @observable WCSMode: boolean = true;

    @action setWCSMode = (value?: boolean) => {
        this.WCSMode = value === undefined ? !this.WCSMode : value;
    };

    @action private setSelectedTab = (tab: DistanceMeasuringDialogTabs) => {
        this.selectedTab = tab;
    };

    private handleChangeWCSMode = (coord: CoordinateMode) => {
        const WCSMode = coord === CoordinateMode.Image ? false : true;
        this.setWCSMode(WCSMode);
    };

    private static readonly DefaultWidth = 450;
    private static readonly DefaultHeight = 350;
    private static readonly MinWidth = 450;
    private static readonly MinHeight = 300;

    private static HandleValueChange = (distanceMeasuringStore: DistanceMeasuringStore, wcsInfo: AST.FrameSet, WCSStart: WCSPoint2D, WCSFinish: WCSPoint2D, isX: boolean, finish?: boolean, pixel?: boolean) => {
        if (pixel) {
            return (value: number): boolean => {
                if (!isFinite(value)) {
                    return false;
                }
                if (isX && finish) {
                    distanceMeasuringStore?.setFinish(value, distanceMeasuringStore?.finish.y);
                } else if (finish) {
                    distanceMeasuringStore?.setFinish(distanceMeasuringStore?.finish.x, value);
                } else if (isX) {
                    distanceMeasuringStore?.setStart(value, distanceMeasuringStore?.start.y);
                } else {
                    distanceMeasuringStore?.setStart(distanceMeasuringStore?.start.x, value);
                }
                distanceMeasuringStore?.updateTransformedPos(AppStore.Instance.activeFrame.spatialTransform);
                return true;
            };
        } else {
            return (value: string): boolean => {
                if (!wcsInfo) {
                    return false;
                }
                if (isX && isWCSStringFormatValid(value, AppStore.Instance.overlayStore.numbers.formatTypeX)) {
                    if (finish) {
                        const finishPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...WCSFinish, x: value});
                        distanceMeasuringStore?.setFinish(finishPixelFromWCS.x, finishPixelFromWCS.y);
                    } else {
                        const startPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...WCSStart, x: value});
                        distanceMeasuringStore?.setStart(startPixelFromWCS.x, startPixelFromWCS.y);
                    }
                    distanceMeasuringStore?.updateTransformedPos(AppStore.Instance.activeFrame.spatialTransform);
                    return true;
                } else if (!isX && isWCSStringFormatValid(value, AppStore.Instance.overlayStore.numbers.formatTypeY)) {
                    if (finish) {
                        const finishPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...WCSFinish, y: value});
                        distanceMeasuringStore?.setFinish(finishPixelFromWCS.x, finishPixelFromWCS.y);
                    } else {
                        const startPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...WCSStart, y: value});
                        distanceMeasuringStore?.setStart(startPixelFromWCS.x, startPixelFromWCS.y);
                    }
                    distanceMeasuringStore?.updateTransformedPos(AppStore.Instance.activeFrame.spatialTransform);
                    return true;
                } else {
                    return false;
                }
            };
        }
    };

    private coordinateInput = (distanceMeasuringStore, wcsInfo, WCSStart, WCSFinish, finish: boolean) => {
        return (
            <>
                <CoordNumericInput
                    coord={this.WCSMode && wcsInfo ? CoordinateMode.World : CoordinateMode.Image}
                    inputType={InputType.XCoord}
                    value={finish ? distanceMeasuringStore?.finish?.x : distanceMeasuringStore?.start?.x}
                    onChange={DistanceMeasuringDialog.HandleValueChange(distanceMeasuringStore, wcsInfo, WCSStart, WCSFinish, true, finish, true) as (val: number) => boolean}
                    valueWcs={finish ? WCSFinish?.x : WCSStart?.x}
                    onChangeWcs={DistanceMeasuringDialog.HandleValueChange(distanceMeasuringStore, wcsInfo, WCSStart, WCSFinish, true, finish, false) as (val: string) => boolean}
                    wcsDisabled={!wcsInfo}
                />
                <CoordNumericInput
                    coord={this.WCSMode && wcsInfo ? CoordinateMode.World : CoordinateMode.Image}
                    inputType={InputType.YCoord}
                    value={finish ? distanceMeasuringStore?.finish?.y : distanceMeasuringStore?.start?.y}
                    onChange={DistanceMeasuringDialog.HandleValueChange(distanceMeasuringStore, wcsInfo, WCSStart, WCSFinish, false, finish, true) as (val: number) => boolean}
                    valueWcs={finish ? WCSFinish?.y : WCSStart?.y}
                    onChangeWcs={DistanceMeasuringDialog.HandleValueChange(distanceMeasuringStore, wcsInfo, WCSStart, WCSFinish, false, finish, false) as (val: string) => boolean}
                    wcsDisabled={!wcsInfo}
                />
            </>
        );
    };

    render() {
        const appStore = AppStore.Instance;
        // dummy variables related to wcs to trigger re-render
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const system = appStore.overlayStore.global.explicitSystem;
        const frame = appStore.activeFrame;
        const distanceMeasuringStore = frame?.distanceMeasuring;
        const wcsInfo = frame?.validWcs ? frame.wcsInfoForTransformation : 0;
        const WCSStart = getFormattedWCSPoint(wcsInfo, distanceMeasuringStore?.start);
        const WCSFinish = getFormattedWCSPoint(wcsInfo, distanceMeasuringStore?.finish);
        const dialogStore = DialogStore.Instance;

        const zIndexManager = AppStore.Instance.zIndexManager;
        let zIndex = zIndexManager.findIndex(DialogId.DistanceMeasure);

        const dialogProps: IDialogProps = {
            icon: <CustomIcon icon="distanceMeasuring" />,
            backdropClassName: "minimal-dialog-backdrop",
            className: "distance-measurement-dialog",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: dialogStore.distanceMeasuringDialogVisible,
            onClose: dialogStore.hideDistanceMeasuringDialog,
            title: `Distance Measurement (${frame?.filename})`
        };

        const missingFrame = <NonIdealState icon={"error"} title={"Distance measurement tool is not enabled"} description={"Please enable distance measurement tool via the image view toolbar."} />;

        const configurationPanel = (
            <div className="config-panel">
                <FormGroup label="Coordinate" inline={true}>
                    <CoordinateComponent selectedValue={this.WCSMode && wcsInfo ? CoordinateMode.World : CoordinateMode.Image} onChange={this.handleChangeWCSMode} disableCoordinate={!wcsInfo} />
                </FormGroup>
                <FormGroup label="Start" labelInfo={this.WCSMode ? "" : " (px)"} inline={true}>
                    {this.coordinateInput(distanceMeasuringStore, wcsInfo, WCSStart, WCSFinish, false)}
                    {wcsInfo ? <span className="info-string">{this.WCSMode ? `Image: ${Point2D.ToString(distanceMeasuringStore?.start, "px", 3)}` : `WCS: ${WCSPoint2D.ToString(WCSStart)}`}</span> : ""}
                </FormGroup>
                <FormGroup label="Finish" labelInfo={this.WCSMode ? "" : " (px)"} inline={true}>
                    {this.coordinateInput(distanceMeasuringStore, wcsInfo, WCSStart, WCSFinish, true)}
                    {wcsInfo ? <span className="info-string">{this.WCSMode ? `Image: ${Point2D.ToString(distanceMeasuringStore?.finish, "px", 3)}` : `WCS: ${WCSPoint2D.ToString(WCSFinish)}`}</span> : ""}
                </FormGroup>
            </div>
        );

        const stylingPanel = (
            <div className="styling-panel">
                <FormGroup label="Color" inline={true}>
                    <ColorPickerComponent
                        color={distanceMeasuringStore?.color}
                        presetColors={SWATCH_COLORS}
                        setColor={(color: ColorResult) => distanceMeasuringStore?.setColor(color.hex)}
                        disableAlpha={true}
                        darkTheme={appStore.darkTheme}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Line width" labelInfo="(px)">
                    <SafeNumericInput placeholder="Line width" min={0.5} max={20} value={distanceMeasuringStore?.lineWidth} stepSize={0.5} onValueChange={value => distanceMeasuringStore?.setLineWidth(value)} />
                </FormGroup>
                <FormGroup inline={true} label="Font size" labelInfo="(px)">
                    <SafeNumericInput placeholder="Font size" min={0.5} max={50} value={distanceMeasuringStore?.fontSize} stepSize={1} onValueChange={value => distanceMeasuringStore?.setFontSize(value)} />
                </FormGroup>
            </div>
        );

        return (
            <DraggableDialogComponent
                dialogProps={dialogProps}
                helpType={HelpType.DISTANCE_MEASUREMENT}
                defaultWidth={DistanceMeasuringDialog.DefaultWidth}
                defaultHeight={DistanceMeasuringDialog.DefaultHeight}
                minWidth={DistanceMeasuringDialog.MinWidth}
                minHeight={DistanceMeasuringDialog.MinHeight}
                enableResizing={true}
                zIndex={zIndex}
                onSelected={() => zIndexManager.updateIndexOnSelect(DialogId.DistanceMeasure)}
                onClosed={() => zIndexManager.updateIndexOnRemove(DialogId.DistanceMeasure)}
            >
                <div className={Classes.DIALOG_BODY}>
                    {appStore.activeLayer === ImageViewLayer.DistanceMeasuring ? (
                        <Tabs id="regionDialogTabs" selectedTabId={this.selectedTab} onChange={this.setSelectedTab}>
                            <Tab id={DistanceMeasuringDialogTabs.Configuration} title="Configuration" panel={configurationPanel} />
                            <Tab id={DistanceMeasuringDialogTabs.Styling} title="Styling" panel={stylingPanel} />
                        </Tabs>
                    ) : (
                        missingFrame
                    )}
                </div>
            </DraggableDialogComponent>
        );
    }
}
