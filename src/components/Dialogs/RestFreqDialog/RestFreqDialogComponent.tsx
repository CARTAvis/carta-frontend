import * as React from "react";
import classNames from "classnames";
import {observer} from "mobx-react";
import {action, observable, computed, makeObservable, autorun} from "mobx";
import {FormGroup, IDialogProps, Button, Intent, Classes, Text, HTMLSelect, NonIdealState} from "@blueprintjs/core";
import {DraggableDialogComponent} from "components/Dialogs";
import {ClearableNumericInputComponent} from "components/Shared";
import {AppStore, HelpType} from "stores";
import {FrequencyUnit} from "models";
import "./RestFreqDialogComponent.scss";

@observer
export class RestFreqDialogComponent extends React.Component {
    private defaultRestFreq: number;
    private defaultUnit: FrequencyUnit = FrequencyUnit.HZ;

    @observable filename: string = "";
    @observable private restFreq: number;
    @observable private unit: FrequencyUnit = FrequencyUnit.HZ;

    @action private setFilename = (val: string) => {
        this.filename = val;
    };

    @action private setRestFreq = (val: number) => {
        this.restFreq = val;
    };

    @action private setUnit = (val: FrequencyUnit) => {
        this.unit = val;
    };

    @action private restoreDefaults = () => {
        this.restFreq = this.defaultRestFreq;
        this.unit = this.defaultUnit;
    };

    constructor(props: any) {
        super(props);
        makeObservable(this);

        autorun(() => {
            const appStore = AppStore.Instance;
            const frame = appStore.getFrame(appStore.dialogStore.restFreqDialogFileId);
            this.setFilename(frame?.filename);

            const headerRestFreq = this.convertUnit(frame?.headerRestFreq);
            this.defaultRestFreq = headerRestFreq?.value;
            this.defaultUnit = headerRestFreq?.unit;

            const customRestFreq = this.convertUnit(frame?.customRestFreq);
            this.setRestFreq(customRestFreq?.value);
            this.setUnit(customRestFreq?.unit);
        });
    }

    @computed private get inValidInput(): boolean {
        return !isFinite(this.restFreq);
    }

    private convertUnit = (restFreq: number) => {
        if (restFreq >= 1e9) {
            return {value: restFreq / 1e9, unit: FrequencyUnit.GHZ};
        } else if (restFreq >= 1e6) {
            return {value: restFreq / 1e6, unit: FrequencyUnit.MHZ};
        } else if (restFreq >= 1e3) {
            return {value: restFreq / 1e3, unit: FrequencyUnit.KHZ};
        } else {
            return {value: restFreq, unit: FrequencyUnit.HZ};
        }
    };

    private saveRestFreq = () => {
        const appStore = AppStore.Instance;
        const frame = appStore.getFrame(appStore.dialogStore.restFreqDialogFileId);
        if (!frame || this.inValidInput) {
            return;
        }

        switch (this.unit) {
            case FrequencyUnit.GHZ:
                frame.updateCustomRestFreq(this.restFreq * 1e9);
                break;
            case FrequencyUnit.MHZ:
                frame.updateCustomRestFreq(this.restFreq * 1e6);
                break;
            case FrequencyUnit.KHZ:
                frame.updateCustomRestFreq(this.restFreq * 1e3);
                break;
            default:
                frame.updateCustomRestFreq(this.restFreq);
                break;
        }
        appStore.dialogStore.hideRestFreqDialog();
    };

    render() {
        const appStore = AppStore.Instance;
        const frame = appStore.getFrame(appStore.dialogStore.restFreqDialogFileId);

        const className = classNames("freq-dialog", {"bp3-dark": appStore.darkTheme});

        const dialogProps: IDialogProps = {
            icon: "info-sign",
            backdropClassName: "minimal-dialog-backdrop",
            className: className,
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.dialogStore.restFreqDialogVisible,
            onClose: appStore.dialogStore.hideRestFreqDialog,
            title: "Setting Rest Frequency"
        };

        return (
            <DraggableDialogComponent dialogProps={dialogProps} helpType={HelpType.PLACEHOLDER} defaultWidth={400} defaultHeight={235} enableResizing={true}>
                {!frame ? (
                    <NonIdealState icon={"error"} title={"No image selected"} />
                ) : (
                    <React.Fragment>
                        <div className={Classes.DIALOG_BODY}>
                            <FormGroup inline={true} label="Source" className="name-text">
                                <Text ellipsize={true}>{this.filename}</Text>
                            </FormGroup>
                            <div className="freq-input">
                                <ClearableNumericInputComponent
                                    label="Rest frequency"
                                    value={this.restFreq}
                                    placeholder="rest frequency"
                                    selectAllOnFocus={true}
                                    buttonPosition={"none"}
                                    onValueChanged={this.setRestFreq}
                                    onValueCleared={this.restoreDefaults}
                                />
                                <HTMLSelect options={Object.values(FrequencyUnit)} value={this.unit} onChange={ev => this.setUnit(ev.currentTarget.value as FrequencyUnit)} />
                            </div>
                        </div>
                        <div className={Classes.DIALOG_FOOTER}>
                            <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                                <Button intent={Intent.PRIMARY} text="Save" disabled={this.inValidInput} onClick={this.saveRestFreq} />
                                <Button intent={Intent.NONE} text="Close" onClick={appStore.dialogStore.hideRestFreqDialog} />
                            </div>
                        </div>
                    </React.Fragment>
                )}
            </DraggableDialogComponent>
        );
    }
}
