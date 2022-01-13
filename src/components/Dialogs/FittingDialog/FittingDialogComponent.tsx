import * as React from "react";
import {observer} from "mobx-react";
import {action, makeObservable, observable} from "mobx";
import {AnchorButton, Classes, FormGroup, HTMLSelect, IDialogProps, Intent, NonIdealState, Position, Pre, Tab, Tabs, Text} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import classNames from "classnames";
import {CARTA} from "carta-protobuf";
import {AppStore} from "stores";
import {DraggableDialogComponent} from "components/Dialogs";
import {SafeNumericInput} from "components/Shared";
import "./FittingDialogComponent.scss";

enum FittingResultTabs {
    RESULT,
    LOG
}
@observer
export class FittingDialogComponent extends React.Component {
    @observable fittingResultTabId: FittingResultTabs;

    @action setFittingResultTabId = (tabId: FittingResultTabs) => {
        this.fittingResultTabId = tabId;
    };

    constructor(props: any) {
        super(props);
        makeObservable(this);
        this.fittingResultTabId = FittingResultTabs.LOG;
    }

    private fitImage = () => {
        const fittingStore = AppStore.Instance.imageFittingStore;
        if (fittingStore.fitDisabled) {
            return;
        }

        const message: CARTA.IFittingRequest = {
            fileId: fittingStore.effectiveFrame.frameInfo.fileId,
            regionId: 0,
            estimates: fittingStore.getParamString()
        };
        AppStore.Instance.requestFitting(message);
    };

    render() {
        const appStore = AppStore.Instance;
        const fittingStore = appStore.imageFittingStore;

        const dialogProps: IDialogProps = {
            icon: "regression-chart",
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
                <DraggableDialogComponent dialogProps={dialogProps} minWidth={200} minHeight={140} defaultWidth={600} defaultHeight={660} enableResizing={true}>
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />
                </DraggableDialogComponent>
            );
        }

        const fittingResultPanel = (
            <Pre className="fitting-result-pre">
                <Text className="fitting-result-text">TBD</Text>
            </Pre>
        );

        const fullLogPanel = (
            <Pre className="fitting-result-pre">
                <Text className="log-text">{fittingStore.effectiveFrame?.fittingResult ?? ""}</Text>
            </Pre>
        );

        return (
            <DraggableDialogComponent dialogProps={dialogProps} minWidth={200} minHeight={140} defaultWidth={600} defaultHeight={660} enableResizing={true}>
                <div className={Classes.DIALOG_BODY}>
                    <FormGroup label="Data Source" inline={true}>
                        <HTMLSelect value={fittingStore.selectedFileId} options={fittingStore.frameOptions} onChange={ev => fittingStore.setSelectedFileId(parseInt(ev.target.value))} />
                    </FormGroup>
                    <FormGroup label="Center" inline={true} labelInfo="(px)">
                        <SafeNumericInput value={fittingStore.center?.x ?? ""} onValueChange={fittingStore.setCenterX} buttonPosition="none" placeholder="Center X" />
                        <SafeNumericInput value={fittingStore.center?.y ?? ""} onValueChange={fittingStore.setCenterY} buttonPosition="none" placeholder="Center Y" />
                    </FormGroup>
                    <FormGroup label="Amplitude" inline={true} labelInfo={`(${fittingStore.effectiveFrame?.unit})`}>
                        <SafeNumericInput value={fittingStore.amplitude ?? ""} onValueChange={fittingStore.setAmplitude} buttonPosition="none" placeholder="Amplitude" />
                    </FormGroup>
                    <FormGroup label="FWHM" inline={true} labelInfo="(arcsec)">
                        <SafeNumericInput value={fittingStore.majorAxis ?? ""} onValueChange={fittingStore.setMajorAxis} buttonPosition="none" placeholder="Major Axis" />
                        <SafeNumericInput value={fittingStore.minorAxis ?? ""} onValueChange={fittingStore.setMinorAxis} buttonPosition="none" placeholder="Minor Axis" />
                    </FormGroup>
                    <FormGroup label="P.A." inline={true} labelInfo="(deg)">
                        <SafeNumericInput value={fittingStore.pa ?? ""} onValueChange={fittingStore.setPa} buttonPosition="none" placeholder="Position Angle" />
                    </FormGroup>
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <Tooltip2 content="Clear fitting parameters." position={Position.BOTTOM}>
                            <AnchorButton intent={Intent.WARNING} onClick={fittingStore.clearParams} text="Clear" />
                        </Tooltip2>
                        <Tooltip2 content="Clear existing fitting results and fit the current channel of the image." position={Position.BOTTOM}>
                            <AnchorButton intent={Intent.PRIMARY} onClick={this.fitImage} text="Fit" disabled={fittingStore.fitDisabled} />
                        </Tooltip2>
                    </div>
                </div>
                <div className={classNames(Classes.DIALOG_BODY, "fitting-result")}>
                    <Tabs id="fittingResultTabs" vertical={true} selectedTabId={this.fittingResultTabId} onChange={this.setFittingResultTabId}>
                        <Tab id={FittingResultTabs.RESULT} title="Fitting Result" panel={fittingResultPanel} />
                        <Tab id={FittingResultTabs.LOG} title="Full Log" panel={fullLogPanel} />
                    </Tabs>
                </div>
            </DraggableDialogComponent>
        );
    }
}
