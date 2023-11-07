import * as React from "react";
import {AnchorButton, Classes, FormGroup, IDialogProps, InputGroup, Intent, Position} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import classNames from "classnames";
import {computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {DraggableDialogComponent} from "components/Dialogs";
import {PresetLayout} from "models";
import {AppStore, HelpType} from "stores";

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
            AppStore.Instance.layoutStore.isSave ? this.saveLayout() : this.renameLayout();
        }
    };

    private saveLayout = async () => {
        const appStore = AppStore.Instance;

        appStore.dialogStore.hideSaveLayoutDialog();
        appStore.layoutStore.setLayoutToBeSaved(this.layoutName.trim());
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

    private renameLayout = async () => {
        const appStore = AppStore.Instance;
        await appStore.layoutStore.renameLayout(appStore.layoutStore.oldLayoutName, this.layoutName.trim());
        this.clearInput();
    };

    @computed get isEmpty(): boolean {
        return !this.layoutName?.trim();
    }

    @computed get validName(): boolean {
        return this.layoutName.match(/^[^~`!*()\-+=[.'?<>/|\\:;&]+$/)?.length > 0;
    }

    render() {
        const appStore = AppStore.Instance;
        const className = classNames("preference-dialog", {"bp3-dark": appStore.darkTheme});
        const isSave = appStore.layoutStore.isSave;

        const dialogProps: IDialogProps = {
            icon: "layout-grid",
            backdropClassName: "minimal-dialog-backdrop",
            className: className,
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.dialogStore.saveLayoutDialogVisible,
            onClose: appStore.dialogStore.hideSaveLayoutDialog,
            title: isSave ? "Save Layout" : `Rename Layout`
        };

        return (
            <DraggableDialogComponent dialogProps={dialogProps} helpType={HelpType.SAVE_LAYOUT} defaultWidth={400} defaultHeight={185} enableResizing={true}>
                <div className={Classes.DIALOG_BODY}>
                    <FormGroup inline={true} label={isSave ? "Save current layout as:" : `Rename ${appStore.layoutStore.oldLayoutName} to:`}>
                        <Tooltip2 isOpen={!this.isEmpty && !this.validName} position={Position.BOTTOM_LEFT} content={"Layout name should not contain ~, `, !, *, (, ), -, +, =, [, ., ', ?, <, >, /, |, \\, :, ; or &"}>
                            <InputGroup className="layout-name-input" placeholder="Enter layout name" value={this.layoutName} autoFocus={true} onChange={this.handleInput} onKeyDown={this.handleKeyDown} />
                        </Tooltip2>
                    </FormGroup>
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <Tooltip2 content="Layout name cannot be empty!" disabled={!this.isEmpty}>
                            <AnchorButton intent={Intent.PRIMARY} onClick={isSave ? this.saveLayout : this.renameLayout} text={isSave ? "Save" : "Rename"} disabled={this.isEmpty || !this.validName} />
                        </Tooltip2>
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}
