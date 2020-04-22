import * as React from "react";
import {observable, computed} from "mobx";
import {observer} from "mobx-react";
import {FormGroup, InputGroup, IDialogProps, Button, Intent, Classes, Tooltip} from "@blueprintjs/core";
import {DraggableDialogComponent} from "components/Dialogs";
import {AlertStore, AppStore, DialogStore, HelpType} from "stores";
import {PresetLayout} from "models";
import "./SaveLayoutDialogComponent.css";

const KEYCODE_ENTER = 13;

@observer
export class SaveLayoutDialogComponent extends React.Component {
    @observable private layoutName: string = "";

    private handleInput = (ev: React.FormEvent<HTMLInputElement>) => {
        this.layoutName = ev.currentTarget.value;
    };

    private clearInput = () => {
        this.layoutName = "";
    };

    private handleKeyDown = (ev) => {
        if (ev.keyCode === KEYCODE_ENTER && !this.isEmpty) {
            this.saveLayout();
        }
    };

    private saveLayout = () => {
        const appStore = AppStore.Instance;

        appStore.dialogStore.hideSaveLayoutDialog();
        appStore.layoutStore.setLayoutToBeSaved(this.layoutName);
        if (appStore.layoutStore.layoutExist(this.layoutName)) {
            if (PresetLayout.isPreset(this.layoutName)) {
                appStore.alertStore.showAlert("Layout name cannot be the same as system presets.");
            } else {
                appStore.alertStore.showInteractiveAlert(`Are you sure to overwrite the existing layout ${this.layoutName}?`, (confirmed: boolean) => {
                    if (confirmed) {
                        appStore.layoutStore.saveLayout();
                    }
                });
            }
        } else {
            appStore.layoutStore.saveLayout();
        }
        this.clearInput();
    };

    @computed get isEmpty(): boolean {
        return !this.layoutName;
    }

    render() {
        const appStore = AppStore.Instance;

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
            isOpen: appStore.dialogStore.saveLayoutDialogVisible,
            onClose: appStore.dialogStore.hideSaveLayoutDialog,
            title: "Save Layout",
        };

        return (
            <DraggableDialogComponent dialogProps={dialogProps} helpType={HelpType.SAVE_LAYOUT} defaultWidth={400} defaultHeight={185} enableResizing={true}>
                <div className={Classes.DIALOG_BODY}>
                    <FormGroup inline={true} label="Save current layout as:">
                        <InputGroup className="layout-name-input" placeholder="Enter layout name" value={this.layoutName} autoFocus={true} onChange={this.handleInput} onKeyDown={this.handleKeyDown}/>
                    </FormGroup>
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <Tooltip content="Layout name cannot be empty!" disabled={!this.isEmpty}>
                            <Button intent={Intent.PRIMARY} onClick={this.saveLayout} text="Save" disabled={this.isEmpty}/>
                        </Tooltip>
                        <Button
                            intent={Intent.NONE}
                            text="Close"
                            onClick={() => {
                                appStore.dialogStore.hideSaveLayoutDialog();
                                this.clearInput();
                            }}
                        />
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}
