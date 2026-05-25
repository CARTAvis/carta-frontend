import * as React from "react";
import Iframe from "react-iframe";
import {Classes, type DialogProps} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {DraggableDialogComponent} from "components/Dialogs";
import {DialogId} from "enums";
import {AppStore} from "stores";

import "./ExternalPageDialogComponent.scss";

@observer
export class ExternalPageDialogComponent extends React.Component {
    private static readonly DefaultWidth = 800;
    private static readonly DefaultHeight = 600;
    private static readonly MinWidth = 400;
    private static readonly MinHeight = 400;

    render() {
        const appStore = AppStore.Instance;
        const className = classNames("iframe-dialog", {[Classes.DARK]: appStore.isDarkTheme});

        const dialogProps: DialogProps = {
            icon: "info-sign",
            className: className,
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.dialogStore.dialogVisible.get(DialogId.ExternalPage) ?? false,
            title: appStore.dialogStore.externalPageDialogTitle
        };

        return (
            <DraggableDialogComponent
                dialogProps={dialogProps}
                defaultWidth={ExternalPageDialogComponent.DefaultWidth}
                defaultHeight={ExternalPageDialogComponent.DefaultHeight}
                minWidth={ExternalPageDialogComponent.MinWidth}
                minHeight={ExternalPageDialogComponent.MinHeight}
                enableResizing={true}
                dialogId={DialogId.ExternalPage}
            >
                <div className={Classes.DIALOG_BODY}>
                    <Iframe url={appStore.dialogStore.externalPageDialogUrl} />
                </div>
            </DraggableDialogComponent>
        );
    }
}
