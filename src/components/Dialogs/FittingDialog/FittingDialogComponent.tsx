import * as React from "react";
import SplitPane from "react-split-pane";
import {AnchorButton, ButtonGroup, Classes, DialogProps, Divider, FormGroup, HTMLSelect, Intent, NonIdealState, Position, Pre, Slider, Switch, Tab, Tabs, Text} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import classNames from "classnames";
import {action, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {DraggableDialogComponent, TaskProgressDialogComponent} from "components/Dialogs";
import {ClearableNumericInputComponent, CoordinateComponent, CoordNumericInput, ImageCoordNumericInput, InputType, SafeNumericInput} from "components/Shared";
import {CustomIcon} from "icons/CustomIcons";
import {Point2D, WCSPoint2D} from "models";
import {AppStore, HelpType} from "stores";
import {CoordinateMode} from "stores/Frame";
import {exportTxtFile, getTimestamp} from "utilities";

import "./FittingDialogComponent.scss";

enum FittingResultTabs {
    RESULT,
    LOG
}

@observer
export class FittingDialogComponent extends React.Component {
    @observable private coord: CoordinateMode = CoordinateMode.Image;
    @observable private fittingResultTabId: FittingResultTabs = FittingResultTabs.RESULT;
    @observable private isMouseEntered: boolean = false;

    @action private setCoord = (coord: CoordinateMode) => {
        this.coord = coord;
    };

    @action private setFittingResultTabId = (tabId: FittingResultTabs) => {
        this.fittingResultTabId = tabId;
    };

    @action private onMouseEnter = () => {
        this.isMouseEntered = true;
    };

    @action private onMouseLeave = () => {
        this.isMouseEntered = false;
    };

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    private renderParamCoordInput = (inputType: InputType, value: number, customPlaceholder: string, onValueChange, valueWcs: string, onValueChangeWcs) => {
        return (
            <CoordNumericInput
                coord={this.coord}
                inputType={inputType}
                value={value}
                onChange={onValueChange}
                valueWcs={valueWcs}
                onChangeWcs={onValueChangeWcs}
                wcsDisabled={!AppStore.Instance.imageFittingStore?.effectiveFrame?.hasSquarePixels}
                customPlaceholder={customPlaceholder}
            />
        );
    };

    private renderParamInput = (value: number, placeholder: string, onValueChange) => {
        return <ImageCoordNumericInput value={value} customPlaceholder={placeholder} onChange={onValueChange} />;
    };

    private renderLockButton = (fixed: boolean, toggleFixed) => {
        return <AnchorButton className="lock-button" onClick={toggleFixed} icon={fixed ? "lock" : "unlock"} />;
    };

    private renderInfoString = (point: Point2D, pointWcs: WCSPoint2D) => {
        return (
            <span className="info-string">
                {this.coord === CoordinateMode.Image ? `WCS: ${pointWcs?.x || pointWcs?.y ? WCSPoint2D.ToString(pointWcs) : "-"}` : `Image: ${isFinite(point?.x) || isFinite(point?.y) ? Point2D.ToString(point, "px", 3) : "-"}`}
            </span>
        );
    };

    private exportResult = () => {
        const content = AppStore.Instance.imageFittingStore.effectiveFrame?.fittingResult;
        const fileName = `${AppStore.Instance.imageFittingStore.effectiveFrame?.filename}-${getTimestamp()}-2D_Fitting_Result`;
        exportTxtFile(fileName, content);
    };

    private exportFullLog = () => {
        const content = AppStore.Instance.imageFittingStore.effectiveFrame?.fittingLog;
        const fileName = `${AppStore.Instance.imageFittingStore.effectiveFrame?.filename}-${getTimestamp()}-2D_Fitting_Full_Log`;
        exportTxtFile(fileName, content);
    };

    render() {
        const appStore = AppStore.Instance;
        const fittingStore = appStore.imageFittingStore;
        let component = fittingStore.components[fittingStore.selectedComponentIndex];

        const dialogProps: DialogProps = {
            icon: <CustomIcon icon="imageFitting" size={CustomIcon.SIZE_LARGE} />,
            className: "fitting-dialog",
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.dialogStore.fittingDialogVisible,
            onClose: appStore.dialogStore.hideFittingDialog,
            title: "Image Fitting"
        };

        if (!appStore || appStore.frameNum <= 0 || !fittingStore.effectiveFrame) {
            return (
                <DraggableDialogComponent dialogProps={dialogProps} helpType={HelpType.IMAGE_FITTING} minWidth={350} minHeight={265} defaultWidth={600} defaultHeight={660} enableResizing={true}>
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />
                </DraggableDialogComponent>
            );
        }

        const createRegionButton = (
            <Tooltip2 content={"Create ellipse regions"} position={Position.LEFT}>
                <AnchorButton icon="circle" onClick={fittingStore.createRegions}></AnchorButton>
            </Tooltip2>
        );

        const fittingResultPanel = (
            <Pre className="fitting-result-pre">
                <Text className="fitting-result-text">{fittingStore.effectiveFrame?.fittingResult ?? ""}</Text>
                {fittingStore.effectiveFrame?.fittingResult !== "" && (
                    <ButtonGroup className="output-button" style={{opacity: this.isMouseEntered && fittingStore.effectiveFrame.fittingResult !== "" ? 1 : 0}}>
                        {createRegionButton}
                        <Tooltip2 content={"Export as txt"} position={Position.LEFT}>
                            <AnchorButton icon="th" onClick={this.exportResult}></AnchorButton>
                        </Tooltip2>
                    </ButtonGroup>
                )}
            </Pre>
        );

        const fullLogPanel = (
            <Pre className="fitting-result-pre">
                <Text className="log-text">{fittingStore.effectiveFrame?.fittingLog ?? ""}</Text>
                {fittingStore.effectiveFrame?.fittingLog !== "" && (
                    <ButtonGroup className="output-button" style={{opacity: this.isMouseEntered && fittingStore.effectiveFrame.fittingLog !== "" ? 1 : 0}}>
                        {createRegionButton}
                        <Tooltip2 content={"Export as txt"} position={Position.LEFT}>
                            <AnchorButton icon="th" onClick={this.exportFullLog}></AnchorButton>
                        </Tooltip2>
                    </ButtonGroup>
                )}
            </Pre>
        );

        const pixUnitString = this.coord === CoordinateMode.Image ? "(px)" : "";
        const imageUnitString = fittingStore.effectiveFrame?.requiredUnit ? `(${fittingStore.effectiveFrame?.requiredUnit})` : "";

        return (
            <DraggableDialogComponent dialogProps={dialogProps} helpType={HelpType.IMAGE_FITTING} minWidth={350} minHeight={265} defaultWidth={600} defaultHeight={660} enableResizing={true}>
                <div className={classNames(Classes.DIALOG_BODY, "pinned-input-panel")}>
                    <FormGroup label="Data source" inline={true}>
                        <HTMLSelect value={fittingStore.selectedFileId} options={fittingStore.frameOptions} onChange={ev => fittingStore.setSelectedFileId(parseInt(ev.target.value))} />
                    </FormGroup>
                </div>
                <SplitPane split="horizontal" defaultSize="50%">
                    <div className="upper-pane">
                        <div className={classNames(Classes.DIALOG_BODY, "unpinned-input-panel")}>
                            <FormGroup label="Region" inline={true}>
                                <HTMLSelect value={fittingStore.selectedRegionId} options={fittingStore.regionOptions} onChange={ev => fittingStore.setSelectedRegionId(parseInt(ev.target.value))} />
                            </FormGroup>
                            <FormGroup label="Components" inline={true}>
                                <SafeNumericInput
                                    className="components-input"
                                    selectAllOnFocus={true}
                                    value={fittingStore.components.length}
                                    min={1}
                                    max={20}
                                    stepSize={1}
                                    // wait for onBlur events of the inputs
                                    // TODO: find a better way to handle this; one solution is to update the inputs with all keydown events
                                    onValueChange={val => setTimeout(() => fittingStore.setComponents(Math.round(val)), 0)}
                                />
                                {fittingStore.components.length > 1 && (
                                    <>
                                        <Slider
                                            value={fittingStore.selectedComponentIndex + 1}
                                            min={1}
                                            stepSize={1}
                                            max={fittingStore.components.length}
                                            showTrackFill={false}
                                            // wait for onBlur events of the inputs
                                            // TODO: find a better way to handle this; one solution is to update the inputs with all keydown events
                                            onChange={val => setTimeout(() => fittingStore.setSelectedComponentIndex(val - 1), 0)}
                                            disabled={fittingStore.components.length <= 1}
                                        />
                                        <Tooltip2 content="Delete current component">
                                            <AnchorButton icon={"trash"} onClick={fittingStore.deleteSelectedComponent} />
                                        </Tooltip2>
                                    </>
                                )}
                            </FormGroup>
                            <FormGroup label="Coordinate" inline={true}>
                                <CoordinateComponent selectedValue={this.coord} onChange={this.setCoord} disableCoordinate={!fittingStore.effectiveFrame.hasSquarePixels} />
                            </FormGroup>
                            <FormGroup label="Center" inline={true} labelInfo={pixUnitString}>
                                {this.renderParamCoordInput(InputType.XCoord, component?.center?.x, "Center X", component?.setCenterX, component?.centerWcs?.x, component?.setCenterXWcs)}
                                {this.renderLockButton(component?.centerFixed?.x, component?.toggleCenterXFixed)}
                                {this.renderParamCoordInput(InputType.YCoord, component?.center?.y, "Center Y", component?.setCenterY, component?.centerWcs?.y, component?.setCenterYWcs)}
                                {this.renderLockButton(component?.centerFixed?.y, component?.toggleCenterYFixed)}
                                {this.renderInfoString(component?.center, component?.centerWcs)}
                            </FormGroup>
                            <FormGroup label="Amplitude" inline={true} labelInfo={<span title={imageUnitString}>{imageUnitString}</span>}>
                                {this.renderParamInput(component?.amplitude, "Amplitude", component?.setAmplitude)}
                                {this.renderLockButton(component?.amplitudeFixed, component?.toggleAmplitudeFixed)}
                            </FormGroup>
                            <FormGroup label="FWHM" inline={true} labelInfo={pixUnitString}>
                                {this.renderParamCoordInput(InputType.Size, component?.fwhm?.x, "Major axis", component?.setFwhmX, component?.fwhmWcs?.x, component?.setFwhmXWcs)}
                                {this.renderLockButton(component?.fwhmFixed?.x, component?.toggleFwhmXFixed)}
                                {this.renderParamCoordInput(InputType.Size, component?.fwhm?.y, "Minor axis", component?.setFwhmY, component?.fwhmWcs?.y, component?.setFwhmYWcs)}
                                {this.renderLockButton(component?.fwhmFixed?.y, component?.toggleFwhmYFixed)}
                                {this.renderInfoString(component?.fwhm, component?.fwhmWcs)}
                            </FormGroup>
                            <FormGroup label="P.A." inline={true} labelInfo="(deg)">
                                {this.renderParamInput(component?.pa, "Position angle", component?.setPa)}
                                {this.renderLockButton(component?.paFixed, component?.togglePaFixed)}
                            </FormGroup>
                            <Divider />
                            <ClearableNumericInputComponent
                                label="Background"
                                inline={true}
                                labelInfo={<span title={imageUnitString}>{imageUnitString}</span>}
                                value={fittingStore.backgroundOffset}
                                placeholder="Offset"
                                onValueChanged={fittingStore.setBackgroundOffset}
                                onValueCleared={fittingStore.resetBackgroundOffset}
                                showTooltip={false}
                                additionalFormContent={<AnchorButton className="lock-button" onClick={fittingStore.toggleBackgroundOffsetFixed} icon={fittingStore.backgroundOffsetFixed ? "lock" : "unlock"} />}
                            />
                            <FormGroup label="Solver" inline={true}>
                                <HTMLSelect value={fittingStore.solverType} options={fittingStore.solverOptions} onChange={ev => fittingStore.setSolverType(parseInt(ev.target.value))} />
                            </FormGroup>
                        </div>
                        <div className={Classes.DIALOG_FOOTER}>
                            <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                                <Switch checked={fittingStore.createModelImage} onChange={fittingStore.toggleCreateModelImage} label="Model" />
                                <Switch checked={fittingStore.createResidualImage} onChange={fittingStore.toggleCreateResidualImage} label="Residual" />
                                <Tooltip2 content="Clear fitting parameters" position={Position.BOTTOM}>
                                    <AnchorButton intent={Intent.WARNING} onClick={fittingStore.clearComponents} text="Clear" />
                                </Tooltip2>
                                <Tooltip2 content="Clear existing fitting results and fit the current channel of the image" position={Position.BOTTOM} disabled={fittingStore.fitDisabled}>
                                    <AnchorButton intent={Intent.PRIMARY} onClick={fittingStore.fitImage} text="Fit" disabled={fittingStore.fitDisabled} />
                                </Tooltip2>
                            </div>
                        </div>
                    </div>
                    <div className={classNames(Classes.DIALOG_BODY, "lower-pane", "fitting-result-panel")} onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
                        <Tabs id="fittingResultTabs" vertical={true} selectedTabId={this.fittingResultTabId} onChange={this.setFittingResultTabId}>
                            <Tab id={FittingResultTabs.RESULT} title="Fitting Result" panel={fittingResultPanel} />
                            <Tab id={FittingResultTabs.LOG} title="Full Log" panel={fullLogPanel} />
                        </Tabs>
                    </div>
                </SplitPane>
                <TaskProgressDialogComponent
                    isOpen={fittingStore.isFitting}
                    progress={fittingStore?.progress ?? 0}
                    timeRemaining={appStore.estimatedTaskRemainingTime}
                    cancellable={true}
                    onCancel={fittingStore.cancelFitting}
                    text={"Image fitting processing"}
                    isCancelling={fittingStore.isCancelling}
                />
            </DraggableDialogComponent>
        );
    }
}
