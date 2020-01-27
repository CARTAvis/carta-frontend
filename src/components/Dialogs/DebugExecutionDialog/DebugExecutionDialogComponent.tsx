import * as React from "react";
import {observer} from "mobx-react";
import {action, computed, observable} from "mobx";
import {AnchorButton, Classes, Dialog, FormGroup, IDialogProps, InputGroup, Intent} from "@blueprintjs/core";
import {AppStore} from "stores";
import "./DebugExecutionDialogComponent.css";
import {DraggableDialogComponent} from "..";

const KEYCODE_ENTER = 13;

@observer
export class DebugExecutionDialogComponent extends React.Component<{ appStore: AppStore }> {
    @observable action: string = "";
    @observable parameters: string = "";
    @observable isExecuting: boolean;
    @observable errorString: string = "";

    @computed get validInput() {
        const enteredAction = this.props.appStore[this.action];
        if (!enteredAction || typeof (enteredAction) !== "function") {
            return false;
        }

        // Empty parameters are automatically valid
        const parameterString = this.parameters.trim();
        if (!parameterString) {
            return true;
        }

        try {
            const parameterArray = JSON.parse(`[${parameterString}]`);
            if (!Array.isArray(parameterArray) || !parameterArray.length) {
                console.log("Invalid parameter array");
                return false;
            }
        } catch (e) {
            console.log(e);
            return false;
        }

        return true;
    }

    public render() {
        const appStore = this.props.appStore;
        let className = "debug-execution-dialog";
        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

        const dialogProps: IDialogProps = {
            icon: "console",
            className: className,
            canEscapeKeyClose: true,
            canOutsideClickClose: false,
            isOpen: appStore.dialogStore.debugExecutionDialogVisible,
            isCloseButtonShown: true,
            title: "Execute a command"
        };

        return (
            <DraggableDialogComponent dialogProps={dialogProps} defaultWidth={500} defaultHeight={230} enableResizing={false}>
                <div className={Classes.DIALOG_BODY}>
                    <FormGroup helperText={this.errorString} intent={this.errorString ? "danger" : "none"}>
                        <InputGroup placeholder="Action" value={this.action} onChange={this.handleActionInput} onKeyDown={this.handleKeyDown} autoFocus={true}/>
                        <InputGroup placeholder="Parameters" value={this.parameters} onChange={this.handleParameterInput} onKeyDown={this.handleKeyDown}/>
                    </FormGroup>
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <AnchorButton intent={Intent.PRIMARY} onClick={this.onExecuteClicked} disabled={!this.validInput || this.isExecuting} text="Execute"/>
                        <AnchorButton intent={Intent.NONE} onClick={appStore.dialogStore.hideDebugExecutionDialog} text="Close"/>
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }

    private handleKeyDown = (ev) => {
        if (ev.keyCode === KEYCODE_ENTER && this.validInput && !this.isExecuting) {
            this.onExecuteClicked();
        }
    };

    @action handleActionInput = (ev: React.FormEvent<HTMLInputElement>) => {
        this.action = ev.currentTarget.value;
    };

    @action handleParameterInput = (ev: React.FormEvent<HTMLInputElement>) => {
        this.parameters = ev.currentTarget.value;
    };

    @action onExecuteClicked = () => {
        if (!this.validInput) {
            return;
        }

        this.isExecuting = true;

        try {
            const enteredAction = this.props.appStore[this.action];
            const parameterString = this.parameters.trim();
            const parameterArray = JSON.parse(`[${parameterString}]`);
            let response;
            if (parameterArray && parameterArray.length) {
                response = enteredAction(...parameterArray);
            } else {
                response = enteredAction();
            }
            console.log(response);
        } catch (e) {
            console.log(e);
        }

        this.isExecuting = false;
    };
}