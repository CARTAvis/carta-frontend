import * as React from "react";
import {observer} from "mobx-react";
import {IDialogProps} from "@blueprintjs/core";
import {DraggableDialogComponent} from "components/Dialogs";
import {FileInfoComponent, FileInfoType} from "components/FileInfo/FileInfoComponent";
import {AppStore, HelpType} from "stores";
import "./FileInfoDialogComponent.scss";

@observer
export class FileInfoDialogComponent extends React.Component {
    render() {
        const appStore = AppStore.Instance;

        let className = "file-info-dialog";
        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

        const dialogProps: IDialogProps = {
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
