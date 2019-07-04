import * as React from "react";
import {observer} from "mobx-react";
import {FormGroup, InputGroup, IDialogProps, Button, Intent, Classes} from "@blueprintjs/core";
import {DraggableDialogComponent} from "components/Dialogs";
import {AppStore} from "stores";

@observer
export class SaveLayoutDialogComponent extends React.Component<{ appStore: AppStore }> {
    render() {
        const appStore = this.props.appStore;
        const layout = appStore.layoutStore;

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
                    <FormGroup inline={true} label="Save your current layout as:">
                        <InputGroup placeholder="Enter layout name" autoFocus={true}/>
                    </FormGroup>
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <Button intent={Intent.NONE} onClick={appStore.hideSaveLayoutDialog} text="Close"/>
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}
