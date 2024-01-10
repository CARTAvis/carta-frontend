import * as React from "react";
import {Classes, DialogProps} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {DraggableDialogComponent} from "components/Dialogs";
import {FileInfoComponent, FileInfoType} from "components/FileInfo/FileInfoComponent";
import {AppStore, HelpType} from "stores";

import "./FileInfoDialogComponent.scss";

@observer
export class FileInfoDialogComponent extends React.Component {
    render() {
        const appStore = AppStore.Instance;
        const className = classNames("file-info-dialog", {[Classes.DARK]: appStore.darkTheme});

        const dialogProps: DialogProps = {
            icon: "app-header",
            className: className,
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.dialogStore.fileInfoDialogVisible,
            onClose: appStore.dialogStore.hideFileInfoDialog,
            title: "File Header"
        };

        return (
            <DraggableDialogComponent dialogProps={dialogProps} helpType={HelpType.FILE_INFO} minWidth={400} minHeight={400} defaultWidth={800} defaultHeight={600} enableResizing={true}>
                <div className={Classes.DIALOG_BODY}>
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
