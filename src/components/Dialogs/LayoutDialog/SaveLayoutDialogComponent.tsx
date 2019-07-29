import * as React from "react";
import {observable, computed} from "mobx";
import {observer} from "mobx-react";
import {FormGroup, InputGroup, IDialogProps, Button, Intent, Classes, Tooltip} from "@blueprintjs/core";
import {DraggableDialogComponent} from "components/Dialogs";
import {AppStore} from "stores";
import {PresetLayout} from "models";
import "./SaveLayoutDialogComponent.css";

@observer
export class SaveLayoutDialogComponent extends React.Component<{ appStore: AppStore }> {
    @observable private layoutName: string = "";

    private handleInput = (ev: React.FormEvent<HTMLInputElement>) => {
        this.layoutName = ev.currentTarget.value;
    };

    private clearInput = () => {
        this.layoutName = "";
    };

    private saveLayout = () => {
        const appStore = this.props.appStore;
        const layoutStore = this.props.appStore.layoutStore;
        const alertStore = this.props.appStore.alertStore;

        appStore.hideSaveLayoutDialog();
        layoutStore.setLayoutToBeSaved(this.layoutName);
        if (layoutStore.layoutExist(this.layoutName)) {
            PresetLayout.isValid(this.layoutName) ?
            alertStore.showAlert("Layout name cannot be the same as system presets.") :
            alertStore.showInteractiveAlert(`Are you sure to overwrite the existing layout ${this.layoutName}?`);
        } else {
            layoutStore.saveLayout();
        }
        this.clearInput();
    };

    @computed get isEmpty(): boolean {
        return !this.layoutName;
    }

    render() {
        const appStore = this.props.appStore;

        let className = "preference-dialog";
        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

        const dialogProps: IDialogProps = {
            icon: "layout-grid",
            backdropClassName: "minimal-dialog-backdrop",
            className: className,
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.saveLayoutDialogVisible,
            onClose: appStore.hideSaveLayoutDialog,
            title: "Save Layout",
        };

        return (
            <DraggableDialogComponent dialogProps={dialogProps} defaultWidth={400} defaultHeight={185} enableResizing={true}>
                <div className={Classes.DIALOG_BODY}>
                    <FormGroup inline={true} label="Save current layout as:">
                        <InputGroup className="layout-name-input" placeholder="Enter layout name" value={this.layoutName} autoFocus={true} onChange={this.handleInput}/>
                    </FormGroup>
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <Button intent={Intent.NONE} onClick={this.clearInput} disabled={this.isEmpty} text="Clear"/>
                        <Tooltip content="Layout name cannot be empty!" disabled={!this.isEmpty}>
                            <Button intent={Intent.PRIMARY} onClick={this.saveLayout} text="Save" disabled={this.isEmpty}/>
                        </Tooltip>
                        <Button
                            intent={Intent.NONE}
                            text="Close"
                            onClick={() => {
                                appStore.hideSaveLayoutDialog();
                                this.clearInput();
                            }}
                        />
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}
