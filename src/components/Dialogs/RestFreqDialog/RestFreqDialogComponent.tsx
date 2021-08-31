import * as React from "react";
import {observer} from "mobx-react";
import {action, observable, computed, makeObservable} from "mobx";
import {FormGroup, IDialogProps, Button, Intent, Classes, Text, HTMLSelect} from "@blueprintjs/core";
import {DraggableDialogComponent} from "components/Dialogs";
import {ClearableNumericInputComponent} from "components/Shared";
import {AppStore, HelpType} from "stores";
import {FrequencyUnit} from "models";
import "./RestFreqDialogComponent.scss"

@observer
export class RestFreqDialogComponent extends React.Component {

    private defaultRestFreq: number;

    @observable private restFreq: number;
    @observable private unit: FrequencyUnit = FrequencyUnit.HZ;

    @action private setRestFreq = (val: number) => {
        this.restFreq = val;
    };

    @action private clearRestFreq = () => {
        this.restFreq = this.defaultRestFreq;
    };

    @action private setUnit = ev => {
        this.unit = ev.currentTarget.value;
    };

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    @computed private get inValidInput(): boolean {
        return !isFinite(this.restFreq);
    }

    render() {
        const appStore = AppStore.Instance;
        const frame = appStore.getFrame(appStore.dialogStore.restFreqDialogFileId);

        let className = "";
        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

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
                <div className={Classes.DIALOG_BODY + " freq-dialog"}>
                    <FormGroup inline={true} label="Source" className="name-text">
                        <Text ellipsize={true}>{frame?.filename}</Text>
                    </FormGroup>
                    <div className="freq-input">
                        <ClearableNumericInputComponent
                            label="Rest frequency"
                            value={this.restFreq}
                            placeholder="rest frequency"
                            selectAllOnFocus={true}
                            buttonPosition={"none"}
                            onValueChanged={this.setRestFreq}
                            onValueCleared={this.clearRestFreq}
                        />
                        <HTMLSelect options={Object.values(FrequencyUnit)} value={this.unit} onChange={this.setUnit} />
                    </div>
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <Button intent={Intent.PRIMARY} text="Save" disabled={this.inValidInput} />
                        <Button intent={Intent.NONE} text="Close" onClick={appStore.dialogStore.hideRestFreqDialog} />
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}