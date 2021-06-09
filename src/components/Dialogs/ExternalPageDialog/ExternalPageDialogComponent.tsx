import * as React from "react";
import {observer} from "mobx-react";
import {IDialogProps} from "@blueprintjs/core";
import Iframe from "react-iframe";
import {DraggableDialogComponent} from "components/Dialogs";
import {AppStore} from "stores";
import "./ExternalPageDialogComponent.scss";

@observer
export class ExternalPageDialogComponent extends React.Component {
    render() {
        const appStore = AppStore.Instance;

        let className = "iframe-dialog";
        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

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
            <DraggableDialogComponent dialogProps={dialogProps} minWidth={400} minHeight={400} defaultWidth={800} defaultHeight={600} enableResizing={true}>
                <div className="bp3-dialog-body">
                    <Iframe url={appStore.dialogStore.externalPageDialogUrl} />
                </div>
            </DraggableDialogComponent>
        );
    }
}
