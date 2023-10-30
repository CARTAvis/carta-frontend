import * as React from "react";
import Iframe from "react-iframe";
import {IDialogProps} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {DraggableDialogComponent} from "components/Dialogs";
import {AppStore, DialogStore} from "stores";

import "./ExternalPageDialogComponent.scss";

@observer
export class ExternalPageDialogComponent extends React.Component {
    render() {
        const appStore = AppStore.Instance;
        const className = classNames("iframe-dialog", {"bp3-dark": appStore.darkTheme});

        const dialogStore = DialogStore.Instance;
        const id: string = "externalPage-dialog";
        const selectDialog = appStore.floatingObjs.find(w => w.id === id);
        let zIndexNew = selectDialog ? selectDialog.zIndex : 0;

        const dialogProps: IDialogProps = {
            icon: "info-sign",
            className: className,
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.dialogStore.externalPageDialogVisible,
            onClose: appStore.dialogStore.hideExternalPageDialog,
            title: appStore.dialogStore.externalPageDialogTitle
        };

        return (
            <DraggableDialogComponent
                dialogProps={dialogProps}
                minWidth={400}
                minHeight={400}
                defaultWidth={800}
                defaultHeight={600}
                enableResizing={true}
                zIndex={zIndexNew}
                onSelected={() => dialogStore.updateSelectDialogzIndex(id)}
                onClosed={() => dialogStore.updateDialogzIndexOnRemove(zIndexNew)}
            >
                <div className="bp3-dialog-body">
                    <Iframe url={appStore.dialogStore.externalPageDialogUrl} />
                </div>
            </DraggableDialogComponent>
        );
    }
}
