import * as React from "react";
import {observable, computed} from "mobx";
import {observer} from "mobx-react";
import {FormGroup, InputGroup, IDialogProps, Button, Intent, Classes, Tooltip} from "@blueprintjs/core";
import {DraggableDialogComponent} from "components/Dialogs";
import {AppStore} from "stores";
import "./SaveLayoutDialogComponent.css";

@observer
export class SaveLayoutDialogComponent extends React.Component<{ appStore: AppStore }> {
    @observable private layoutName: string = "";

    private handleInput = (ev: React.FormEvent<HTMLInputElement>) => {
        this.layoutName = ev.currentTarget.value;
    };

    private saveLayout = () => {
        this.props.appStore.layoutStore.saveLayout(this.layoutName);
        this.props.appStore.hideSaveLayoutDialog();
        this.layoutName = "";
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
                        <Button intent={Intent.NONE} onClick={() => this.layoutName = ""} disabled={this.isEmpty} text="Clear"/>
                        <Tooltip content="Layout name cannot be empty!" disabled={!this.isEmpty}>
                            <Button intent={Intent.SUCCESS} onClick={this.saveLayout} text="Create" disabled={this.isEmpty}/>
                        </Tooltip>
                        <Button intent={Intent.NONE} onClick={appStore.hideSaveLayoutDialog} text="Close"/>
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}
