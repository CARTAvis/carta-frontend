import * as React from "react";
import {AnchorButton, ButtonGroup, Classes, Dialog, FormGroup, HTMLSelect, Icon, IDialogProps, Intent, NonIdealState, Position, Pre, Slider, Tab, Tabs, Text} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import classNames from "classnames";
import {action, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {DraggableDialogComponent} from "components/Dialogs";
import {SafeNumericInput} from "components/Shared";
import {CustomIcon} from "icons/CustomIcons";
import {AppStore, HelpType} from "stores";
import {exportTxtFile, getTimestamp} from "utilities";

import "./FittingDialogComponent.scss";

enum FittingResultTabs {
    RESULT,
    LOG
}

@observer
export class FittingDialogComponent extends React.Component {
    @observable private fittingResultTabId: FittingResultTabs;
    @observable isMouseEntered: boolean = false;

    @action private setFittingResultTabId = (tabId: FittingResultTabs) => {
        this.fittingResultTabId = tabId;
    };

    @action onMouseEnter = () => {
        this.isMouseEntered = true;
    };

    @action onMouseLeave = () => {
        this.isMouseEntered = false;
    };

    constructor(props: any) {
        super(props);
        makeObservable(this);
        this.fittingResultTabId = FittingResultTabs.RESULT;
    }

    private renderParamInput = (value: number, placeholder: string, onValueChange, fixed: boolean, toggleFixed) => {
        return (
            <>
                <SafeNumericInput value={isFinite(value) ? value : ""} placeholder={placeholder} onValueChange={onValueChange} buttonPosition="none" />
                <AnchorButton className="lock-button" onClick={toggleFixed} icon={fixed ? "lock" : "unlock"} />
            </>
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

        const dialogProps: IDialogProps = {
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
                <DraggableDialogComponent dialogProps={dialogProps} helpType={HelpType.IMAGE_FITTING} minWidth={200} minHeight={140} defaultWidth={600} defaultHeight={660} enableResizing={true}>
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />
                </DraggableDialogComponent>
            );
        }

        const fittingResultPanel = (
            <Pre className="fitting-result-pre">
                <Text className="fitting-result-text">{fittingStore.effectiveFrame?.fittingResult ?? ""}</Text>
                {fittingStore.effectiveFrame?.fittingResult !== "" && (
                    <ButtonGroup className="output-button" style={{opacity: this.isMouseEntered && fittingStore.effectiveFrame.fittingResult !== "" ? 1 : 0}}>
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
                        <Tooltip2 content={"Export as txt"} position={Position.LEFT}>
                            <AnchorButton icon="th" onClick={this.exportFullLog}></AnchorButton>
                        </Tooltip2>
                    </ButtonGroup>
                )}
            </Pre>
        );

        return (
            <DraggableDialogComponent dialogProps={dialogProps} helpType={HelpType.IMAGE_FITTING} minWidth={200} minHeight={140} defaultWidth={600} defaultHeight={660} enableResizing={true}>
                <div className={Classes.DIALOG_BODY}>
                    <FormGroup label="Data Source" inline={true}>
                        <HTMLSelect value={fittingStore.selectedFileId} options={fittingStore.frameOptions} onChange={ev => fittingStore.setSelectedFileId(parseInt(ev.target.value))} />
                    </FormGroup>
                    <FormGroup label="Region" inline={true}>
                        <HTMLSelect value={0} options={[{value: 0, label: "Field of View"}]} disabled={true} />
                    </FormGroup>
                    <FormGroup label="Components" inline={true}>
                        <SafeNumericInput className="components-input" value={fittingStore.components.length} min={1} max={20} stepSize={1} onValueChange={val => fittingStore.setComponents(Math.round(val))} />
                        {fittingStore.components.length > 1 && (
                            <>
                                <Slider
                                    value={fittingStore.selectedComponentIndex + 1}
                                    min={1}
                                    stepSize={1}
                                    max={fittingStore.components.length}
                                    showTrackFill={false}
                                    onChange={val => fittingStore.setSelectedComponentIndex(val - 1)}
                                    disabled={fittingStore.components.length <= 1}
                                />
                                <Tooltip2 content="Delete current component.">
                                    <AnchorButton icon={"trash"} onClick={fittingStore.deleteSelectedComponent} />
                                </Tooltip2>
                            </>
                        )}
                    </FormGroup>
                    <FormGroup label="Center" inline={true} labelInfo="(px)">
                        {this.renderParamInput(component?.center?.x, "Center X", component?.setCenterX, component?.centerFixed?.x, component?.toggleCenterXFixed)}
                        {this.renderParamInput(component?.center?.y, "Center Y", component?.setCenterY, component?.centerFixed?.y, component?.toggleCenterYFixed)}
                    </FormGroup>
                    <FormGroup label="Amplitude" inline={true} labelInfo={fittingStore.effectiveFrame?.requiredUnit ? `(${fittingStore.effectiveFrame?.requiredUnit})` : ""}>
                        {this.renderParamInput(component?.amplitude, "Amplitude", component?.setAmplitude, component?.amplitudeFixed, component?.toggleAmplitudeFixed)}
                    </FormGroup>
                    <FormGroup label="FWHM" inline={true} labelInfo="(px)">
                        {this.renderParamInput(component?.fwhm?.x, "Major Axis", component?.setFwhmX, component?.fwhmFixed?.x, component?.toggleFwhmXFixed)}
                        {this.renderParamInput(component?.fwhm?.y, "Minor Axis", component?.setFwhmY, component?.fwhmFixed?.y, component?.toggleFwhmYFixed)}
                    </FormGroup>
                    <FormGroup label="P.A." inline={true} labelInfo="(deg)">
                        {this.renderParamInput(component?.pa, "Position Angle", component?.setPa, component?.paFixed, component?.togglePaFixed)}
                    </FormGroup>
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <Tooltip2 content="Clear fitting parameters." position={Position.BOTTOM}>
                            <AnchorButton intent={Intent.WARNING} onClick={fittingStore.clearComponents} text="Clear" />
                        </Tooltip2>
                        <Tooltip2 content="Clear existing fitting results and fit the current channel of the image." position={Position.BOTTOM}>
                            <AnchorButton intent={Intent.PRIMARY} onClick={fittingStore.fitImage} text="Fit" disabled={fittingStore.fitDisabled} />
                        </Tooltip2>
                    </div>
                </div>
                <div className={classNames(Classes.DIALOG_BODY, "fitting-result")} onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
                    <Tabs id="fittingResultTabs" vertical={true} selectedTabId={this.fittingResultTabId} onChange={this.setFittingResultTabId}>
                        <Tab id={FittingResultTabs.RESULT} title="Fitting Result" panel={fittingResultPanel} />
                        <Tab id={FittingResultTabs.LOG} title="Full Log" panel={fullLogPanel} />
                    </Tabs>
                </div>
                <Dialog className={classNames(Classes.ALERT, {"bp3-dark": appStore.darkTheme})} isOpen={fittingStore.isFitting}>
                    <div className={Classes.ALERT_BODY}>
                        <Icon icon="time" iconSize={40} />
                        <div className={Classes.ALERT_CONTENTS}>
                            <p>Image fitting processing ...</p>
                            <p>Calculation may take a long time, depending on the size of the file and the number of Gaussian components.</p>
                        </div>
                    </div>
                </Dialog>
            </DraggableDialogComponent>
        );
    }
}
