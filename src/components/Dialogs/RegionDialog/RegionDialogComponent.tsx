import * as React from "react";
import {observer} from "mobx-react";
import {AnchorButton, Classes, IDialogProps, Intent, NonIdealState} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {DraggableDialogComponent} from "components/Dialogs";
import {AppStore} from "stores";
import "./RegionDialogComponent.css";
import {RectangularRegionForm} from "./RectangularRegionForm/RectangularRegionForm";
import {EllipticalRegionForm} from "./EllipticalRegionForm/EllipticalRegionForm";
import {AppearanceForm} from "./AppearanceForm/AppearanceForm";

@observer
export class RegionDialogComponent extends React.Component<{ appStore: AppStore }> {

    private handleDeleteClicked = () => {
        const appStore = this.props.appStore;
        appStore.hideRegionDialog();
        if (appStore.activeFrame && appStore.activeFrame.regionSet.selectedRegion) {
            appStore.activeFrame.regionSet.deleteRegion(appStore.activeFrame.regionSet.selectedRegion);
        }
    };

    public render() {
        const appStore = this.props.appStore;

        const dialogProps: IDialogProps = {
            icon: "info-sign",
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: true,
            lazy: true,
            isOpen: appStore.regionDialogVisible,
            onClose: appStore.hideRegionDialog,
            className: "region-dialog",
            canEscapeKeyClose: true,
            title: "No region selected",
        };

        let bodyContent;
        let editableRegion = false;
        if (!appStore.activeFrame || !appStore.activeFrame.regionSet.selectedRegion) {
            bodyContent = <NonIdealState icon={"folder-open"} title={"No region selected"} description={"Select a region using the list or image view"}/>;
        } else {
            const region = appStore.activeFrame.regionSet.selectedRegion;
            const frame = appStore.activeFrame;

            dialogProps.title = `Editing ${region.nameString}`;
            switch (region.regionType) {
                case CARTA.RegionType.RECTANGLE:
                    bodyContent = (
                        <React.Fragment>
                            <AppearanceForm region={region} darkTheme={appStore.darkTheme}/>
                            <RectangularRegionForm region={region} wcsInfo={frame.validWcs ? frame.wcsInfo : 0}/>
                        </React.Fragment>
                    );
                    editableRegion = true;
                    break;
                case CARTA.RegionType.ELLIPSE:
                    bodyContent = (
                        <React.Fragment>
                            <AppearanceForm region={region} darkTheme={appStore.darkTheme}/>
                            <EllipticalRegionForm region={region} wcsInfo={frame.validWcs ? frame.wcsInfo : 0}/>
                        </React.Fragment>
                    );
                    editableRegion = true;
                    break;
                default:
                    bodyContent = <NonIdealState icon={"error"} title={"Region not supported"} description={"The selected region does not have any editable properties"}/>;
            }
        }

        return (
            <DraggableDialogComponent dialogProps={dialogProps} defaultWidth={600} defaultHeight={450} minHeight={300} minWidth={400} enableResizing={true}>
                <div className={Classes.DIALOG_BODY}>
                    {bodyContent}
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        {editableRegion && <AnchorButton intent={Intent.DANGER} icon={"trash"} text="Delete" onClick={this.handleDeleteClicked}/>}
                        <AnchorButton intent={Intent.NONE} onClick={appStore.hideRegionDialog} text="Close"/>
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}