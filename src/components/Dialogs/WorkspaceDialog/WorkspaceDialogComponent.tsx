import * as React from "react";
import classNames from "classnames";
import {observable, computed, makeObservable} from "mobx";
import {observer} from "mobx-react";
import {AnchorButton, FormGroup, InputGroup, IDialogProps, Button, Intent, Classes} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import {DraggableDialogComponent} from "components/Dialogs";
import {AppStore, HelpType} from "stores";
import {WorkspaceListItem} from "models";
import "./WorkspaceDialogComponent.scss";

const KEYCODE_ENTER = 13;

@observer
export class WorkspaceDialogComponent extends React.Component<any, {workspaceName: string; workspaceList: WorkspaceListItem[]}> {
    @observable private workspaceName: string = "";

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    componentDidMount() {
        const appStore = AppStore.Instance;
        appStore.apiService.getWorkspaceList().then(console.log);
    }

    private handleInput = (ev: React.FormEvent<HTMLInputElement>) => {
        this.workspaceName = ev.currentTarget.value;
    };

    private clearInput = () => {
        this.workspaceName = "";
    };

    private handleKeyDown = ev => {
        if (ev.keyCode === KEYCODE_ENTER && !this.isEmpty) {
            this.saveWorkspace();
        }
    };

    private saveWorkspace = async () => {
        const appStore = AppStore.Instance;

        appStore.dialogStore.hideSaveWorkspaceDialog();
        // appStore.layoutStore.setLayoutToBeSaved(this.workspaceName);
        // if (appStore.layoutStore.layoutExists(this.workspaceName)) {
        //     if (PresetLayout.isPreset(this.workspaceName)) {
        //         appStore.alertStore.showAlert("Layout name cannot be the same as system presets.");
        //     } else {
        //         const confirmed = await appStore.alertStore.showInteractiveAlert(`Are you sure to overwrite the existing layout ${this.workspaceName}?`);
        //         if (confirmed) {
        //             await appStore.layoutStore.saveLayout();
        //         }
        //     }
        // } else {
        //     await appStore.layoutStore.saveLayout();
        // }
        this.clearInput();
    };

    @computed get isEmpty(): boolean {
        return !this.workspaceName;
    }

    render() {
        const appStore = AppStore.Instance;

        if (!appStore.dialogStore.saveWorkspaceDialogVisible) {
            return null;
        }

        const className = classNames("workspace-dialog", {"bp3-dark": appStore.darkTheme});

        const dialogProps: IDialogProps = {
            icon: "layout-grid",
            backdropClassName: "minimal-dialog-backdrop",
            className: className,
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.dialogStore.saveWorkspaceDialogVisible,
            onClose: appStore.dialogStore.hideSaveWorkspaceDialog,
            title: "Save Workspace"
        };

        return (
            <DraggableDialogComponent dialogProps={dialogProps} helpType={HelpType.SAVE_WORKSPACE} defaultWidth={425} defaultHeight={200} minWidth={425} minHeight={200} enableResizing={true}>
                <div className={Classes.DIALOG_BODY}>
                    <FormGroup inline={true} label="Save current workspace as:">
                        <InputGroup className="workspace-name-input" placeholder="Enter workspace name" value={this.workspaceName} autoFocus={true} onChange={this.handleInput} onKeyDown={this.handleKeyDown} />
                    </FormGroup>
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <Tooltip2 content="Workspace name cannot be empty!" disabled={!this.isEmpty}>
                            <AnchorButton intent={Intent.PRIMARY} onClick={this.saveWorkspace} text="Save" disabled={this.isEmpty} />
                        </Tooltip2>
                        <Button
                            intent={Intent.NONE}
                            text="Close"
                            onClick={() => {
                                appStore.dialogStore.hideSaveWorkspaceDialog();
                                this.clearInput();
                            }}
                        />
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}
