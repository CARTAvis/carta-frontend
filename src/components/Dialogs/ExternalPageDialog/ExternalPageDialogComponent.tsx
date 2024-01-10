import * as React from "react";
import Iframe from "react-iframe";
import {Classes, DialogProps} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {DraggableDialogComponent} from "components/Dialogs";
import {AppStore} from "stores";

import "./ExternalPageDialogComponent.scss";

@observer
export class ExternalPageDialogComponent extends React.Component {
    render() {
        const appStore = AppStore.Instance;
        const className = classNames("iframe-dialog", {[Classes.DARK]: appStore.darkTheme});

        const dialogProps: DialogProps = {
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
                <div className={Classes.DIALOG_BODY}>
                    <Iframe url={appStore.dialogStore.externalPageDialogUrl} />
                </div>
            </DraggableDialogComponent>
        );
    }
}
