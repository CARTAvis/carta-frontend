import * as React from "react";
import classNames from "classnames";
import {observable, computed, makeObservable} from "mobx";
import {observer} from "mobx-react";
import {AnchorButton, FormGroup, InputGroup, DialogProps, Button, Intent, Classes} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import {DraggableDialogComponent} from "components/Dialogs";
import {AppStore, HelpType} from "stores";
import {PresetLayout} from "models";
import "./SaveLayoutDialogComponent.scss";

const KEYCODE_ENTER = 13;

@observer
export class SaveLayoutDialogComponent extends React.Component {
    @observable private layoutName: string = "";

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    private handleInput = (ev: React.FormEvent<HTMLInputElement>) => {
        this.layoutName = ev.currentTarget.value;
    };

    private clearInput = () => {
        this.layoutName = "";
    };

    private handleKeyDown = ev => {
        if (ev.keyCode === KEYCODE_ENTER && !this.isEmpty) {
            this.saveLayout();
        }
    };

    private saveLayout = async () => {
        const appStore = AppStore.Instance;

        appStore.dialogStore.hideSaveLayoutDialog();
        appStore.layoutStore.setLayoutToBeSaved(this.layoutName);
        if (appStore.layoutStore.layoutExists(this.layoutName)) {
            if (PresetLayout.isPreset(this.layoutName)) {
                appStore.alertStore.showAlert("Layout name cannot be the same as system presets.");
            } else {
                const confirmed = await appStore.alertStore.showInteractiveAlert(`Are you sure to overwrite the existing layout ${this.layoutName}?`);
                if (confirmed) {
                    await appStore.layoutStore.saveLayout();
                }
            }
        } else {
            await appStore.layoutStore.saveLayout();
        }
        this.clearInput();
    };

    @computed get isEmpty(): boolean {
        return !this.layoutName;
    }

    render() {
        const appStore = AppStore.Instance;
        const className = classNames("preference-dialog", {"bp4-dark": appStore.darkTheme});

        const dialogProps: DialogProps = {
            icon: "layout-grid",
            backdropClassName: "minimal-dialog-backdrop",
            className: className,
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.dialogStore.saveLayoutDialogVisible,
            onClose: appStore.dialogStore.hideSaveLayoutDialog,
            title: "Save Layout"
        };

        return (
            <DraggableDialogComponent dialogProps={dialogProps} helpType={HelpType.SAVE_LAYOUT} defaultWidth={400} defaultHeight={185} enableResizing={true}>
                <div className={Classes.DIALOG_BODY}>
                    <FormGroup inline={true} label="Save current layout as:">
                        <InputGroup className="layout-name-input" placeholder="Enter layout name" value={this.layoutName} autoFocus={true} onChange={this.handleInput} onKeyDown={this.handleKeyDown} />
                    </FormGroup>
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <Tooltip2 content="Layout name cannot be empty!" disabled={!this.isEmpty}>
                            <AnchorButton intent={Intent.PRIMARY} onClick={this.saveLayout} text="Save" disabled={this.isEmpty} />
                        </Tooltip2>
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
