import * as React from "react";
import {observable} from "mobx";
import {observer} from "mobx-react";
import {FormGroup, InputGroup, IDialogProps, Button, Intent, Classes} from "@blueprintjs/core";
import {DraggableDialogComponent} from "components/Dialogs";
import {AppStore} from "stores";

@observer
export class SaveLayoutDialogComponent extends React.Component<{ appStore: AppStore }> {
    @observable layoutName: string;

    private handleInput = (ev: React.FormEvent<HTMLInputElement>) => {
        this.layoutName = ev.currentTarget.value;
    };

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
            <DraggableDialogComponent dialogProps={dialogProps} defaultWidth={500} defaultHeight={180} enableResizing={true}>
                <div className={Classes.DIALOG_BODY}>
                    <FormGroup inline={true} label="Save current layout as:">
                        <InputGroup placeholder="Enter layout name" autoFocus={true} onChange={this.handleInput}/>
                    </FormGroup>
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <Button intent={Intent.SUCCESS} onClick={() => appStore.layoutStore.saveLayout(this.layoutName)} text="Create"/>
                        <Button intent={Intent.NONE} onClick={appStore.hideSaveLayoutDialog} text="Close"/>
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}
