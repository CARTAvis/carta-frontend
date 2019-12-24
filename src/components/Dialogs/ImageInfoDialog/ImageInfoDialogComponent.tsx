import * as React from "react";
import {observer} from "mobx-react";
import {observable} from "mobx";
import {IDialogProps} from "@blueprintjs/core";
import {DraggableDialogComponent} from "components/Dialogs";
import {FileInfoComponent, InfoType} from "components/FileInfo/FileInfoComponent";
import {CARTA} from "carta-protobuf";
import {AppStore} from "stores";
import "./ImageInfoDialogComponent.css";

@observer
export class ImageInfoDialogComponent extends React.Component<{ appStore: AppStore }> {

    @observable fileInfoExtended: CARTA.FileInfoExtended;

    render() {

        let className = "image-info-dialog";
        if (this.props.appStore.darkTheme) {
            className += " bp3-dark";
        }

        const appStore = this.props.appStore;

        const dialogProps: IDialogProps = {
            icon: "info-sign",
            className: className,
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.imageInfoDialogVisible,
            onClose: appStore.hideImageInfoDialog,
            title: "Image Info",
        };

        if (appStore.activeFrame) {
            return (
                <DraggableDialogComponent dialogProps={dialogProps} minWidth={400} minHeight={400} defaultWidth={800} defaultHeight={600} enableResizing={true}>
                    <div className="bp3-dialog-body">
                        <FileInfoComponent 
                            infoTypes={[InfoType.IMAGE_FILE, InfoType.IMAGE_HEADER]}
                            fileInfoExtended={appStore.activeFrame.frameInfo.fileInfoExtended} 
                            regionFileInfo={""}
                            selectedTab={appStore.selectedImageInfoTab}
                            handleTabChange={appStore.setSelectedImageInfoTab}
                            isLoading={false}
                            errorMessage={""}
                        />
                    </div>
                </DraggableDialogComponent>
            );
        } else {
            return"";
        }
    }
}
