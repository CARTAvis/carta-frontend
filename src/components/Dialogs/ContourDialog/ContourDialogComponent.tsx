import * as React from "react";
import {observer} from "mobx-react";
import {AnchorButton, Button, Classes, FormGroup, IDialogProps, Intent, MenuItem, NonIdealState} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";
import {DraggableDialogComponent} from "components/Dialogs";
import {AppStore, FrameStore, RenderConfigStore} from "stores";
import "./ContourDialogComponent.css";

const DataSourceSelect = Select.ofType<FrameStore>();

@observer
export class ContourDialogComponent extends React.Component<{ appStore: AppStore }> {
    constructor(props: { appStore: AppStore }) {
        super(props);
    }

    private renderDataSourceSelectItem = (frame: FrameStore, {handleClick, modifiers, query}) => {
        if (!frame) {
            return null;
        }
        return <MenuItem text={frame.frameInfo.fileInfo.name} onClick={handleClick} key={frame.frameInfo.fileId}/>;
    };

    private handleDataSourceSelected = (frame: FrameStore) => {
        this.props.appStore.setActiveFrame(frame.frameInfo.fileId);
    };

    private handleApplyContours = () => {
        const appStore = this.props.appStore;
        if (!appStore || !appStore.activeFrame) {
            return;
        }

        appStore.activeFrame.applyContours();

    };

    private handleClearContours = () => {
        const appStore = this.props.appStore;
        if (!appStore || !appStore.activeFrame) {
            return;
        }

        appStore.activeFrame.clearContours();
    };

    public render() {
        const appStore = this.props.appStore;

        const dialogProps: IDialogProps = {
            icon: "heatmap",
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.contourDialogVisible,
            onClose: appStore.hideContourDialog,
            className: "contour-dialog",
            canEscapeKeyClose: false,
            title: "Contour Configuration",
        };

        if (!appStore || !appStore.activeFrame) {
            return (
                <DraggableDialogComponent dialogProps={dialogProps} defaultWidth={960} defaultHeight={620} enableResizing={true}>
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"}/>
                </DraggableDialogComponent>
            );
        }

        return (
            <DraggableDialogComponent dialogProps={dialogProps} defaultWidth={960} defaultHeight={620} enableResizing={true}>
                <div className={Classes.DIALOG_BODY}>
                    <div className="contour-left-dialog">
                        <FormGroup inline={true} label="Data Source">
                            <DataSourceSelect
                                activeItem={appStore.activeFrame}
                                onItemSelect={this.handleDataSourceSelected}
                                popoverProps={{minimal: true, position: "auto"}}
                                filterable={false}
                                items={appStore.frames}
                                itemRenderer={this.renderDataSourceSelectItem}
                            >
                                <Button text={appStore.activeFrame.frameInfo.fileInfo.name} rightIcon="double-caret-vertical" alignText={"right"}/>
                            </DataSourceSelect>
                        </FormGroup>
                        <p>Placeholder</p>
                    </div>
                    <div className="contour-right-dialog">
                        <p>Placeholder</p>
                        <p>Placeholder</p>
                    </div>
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <AnchorButton intent={Intent.WARNING} onClick={this.handleClearContours} text="Clear"/>
                        <AnchorButton intent={Intent.SUCCESS} onClick={this.handleApplyContours} text="Apply"/>
                        <AnchorButton intent={Intent.NONE} onClick={appStore.hideContourDialog} text="Close"/>
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}
