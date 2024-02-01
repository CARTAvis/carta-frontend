import * as React from "react";
import {IDialogProps} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {DraggableDialogComponent} from "components/Dialogs";
import {FileInfoComponent, FileInfoType} from "components/FileInfo/FileInfoComponent";
import {AppStore, DialogId, HelpType} from "stores";

import "./FileInfoDialogComponent.scss";

@observer
export class FileInfoDialogComponent extends React.Component {
    private static readonly DefaultWidth = 800;
    private static readonly DefaultHeight = 600;
    private static readonly MinWidth = 400;
    private static readonly MinHeight = 400;

    render() {
        const appStore = AppStore.Instance;
        const className = classNames("file-info-dialog", {"bp3-dark": appStore.darkTheme});

        const dialogProps: IDialogProps = {
            icon: "app-header",
            className: className,
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.dialogStore.dialogVisible.get(DialogId.FileInfo),
            title: "File Header"
        };

        return (
            <DraggableDialogComponent
                dialogProps={dialogProps}
                helpType={HelpType.FILE_INFO}
                defaultWidth={FileInfoDialogComponent.DefaultWidth}
                defaultHeight={FileInfoDialogComponent.DefaultHeight}
                minWidth={FileInfoDialogComponent.MinWidth}
                minHeight={FileInfoDialogComponent.MinHeight}
                enableResizing={true}
                dialogId={DialogId.FileInfo}
            >
                <div className="bp3-dialog-body">
                    <FileInfoComponent
                        infoTypes={[FileInfoType.IMAGE_FILE, FileInfoType.IMAGE_HEADER]}
                        fileInfoExtended={appStore.activeFrame ? appStore.activeFrame.frameInfo.fileInfoExtended : null}
                        regionFileInfo={""}
                        catalogFileInfo={null}
                        selectedTab={appStore.dialogStore.selectedFileInfoDialogTab as FileInfoType}
                        handleTabChange={appStore.dialogStore.setSelectedFileInfoDialogTab}
                        isLoading={false}
                        errorMessage={""}
                    />
                </div>
            </DraggableDialogComponent>
        );
    }
}
