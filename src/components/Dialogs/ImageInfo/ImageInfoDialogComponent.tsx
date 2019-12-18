import * as React from "react";
import {observer} from "mobx-react";
import {IDialogProps, Pre, Tab, TabId, Tabs} from "@blueprintjs/core";
import {DraggableDialogComponent} from "components/Dialogs";
import {AppStore, ImageInfoTabs} from "stores";
import "./ImageInfoDialogComponent.css";

@observer
export class ImageInfoDialogComponent extends React.Component<{ appStore: AppStore }> {

    private handleTabChange = (newId: TabId) => {
        this.props.appStore.imageInfoStore.setSelectedTab(newId);
    };

    private renderInfoPanel = () => {
        const imageInfoStore = this.props.appStore.imageInfoStore;
        if (imageInfoStore.selectedTab === ImageInfoTabs.INFO) {
            return <Pre className="image-info-pre">{imageInfoStore.fileInfo}</Pre>;
        } else if (imageInfoStore.selectedTab === ImageInfoTabs.HEADER) {
            return <Pre className="image-info-pre">{imageInfoStore.headers}</Pre>;
        } // probably more tabs will be added in the future

        return "";
    };

    public render() {
        let className = "image-info-dialog";
        if (this.props.appStore.darkTheme) {
            className += " bp3-dark";
        }

        const imageInfoStore = this.props.appStore.imageInfoStore;

        const dialogProps: IDialogProps = {
            icon: "info-sign",
            className: className,
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: imageInfoStore.imageInfoDialogVisible,
            onClose: imageInfoStore.hideImageInfoDialog,
            title: "Image Info",
        };

        return (
            <DraggableDialogComponent dialogProps={dialogProps} minWidth={400} minHeight={400} defaultWidth={800} defaultHeight={600} enableResizing={true}>
                <div className="bp3-dialog-body">
                    <div className="image-info-panes">
                        <div className="image-info-pane">
                            <Tabs id="image-info-tabs" onChange={this.handleTabChange} selectedTabId={imageInfoStore.selectedTab}>
                                <Tab id={ImageInfoTabs.INFO} title="File Information"/>
                                <Tab id={ImageInfoTabs.HEADER} title="Header"/>                                
                            </Tabs>
                            {this.renderInfoPanel()}
                        </div>
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}
