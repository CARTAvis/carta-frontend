import * as React from "react";
import {observer} from "mobx-react";
import {observable} from "mobx";
import {AnchorButton, Classes, IDialogProps, Intent, NonIdealState} from "@blueprintjs/core";
import {DraggableDialogComponent} from "components/Dialogs";
import {AppStore, RegionStore} from "stores";
import {Point2D} from "../../../models";
import "./RegionDialogComponent.css";

@observer
export class RegionDialogComponent extends React.Component<{ appStore: AppStore }> {

    @observable selectedRegion: RegionStore;
    @observable controlPoints: Point2D[];
    @observable regionName: string;

    constructor(props) {
        super(props);

        this.regionName = "";
        this.selectedRegion = null;
        this.controlPoints = [];
    }

    private applyChanges = () => {

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

        if (!appStore.activeFrame || !appStore.activeFrame.regionSet.selectedRegion) {
            bodyContent = <NonIdealState icon={"folder-open"} title={"No region selected"} description={"Select a region using the list or image view"}/>;
        } else {
            const region = appStore.activeFrame.regionSet.selectedRegion;
            dialogProps.title = region.regionId === 0 ? "Editing Cursor" : `Editing Region ${region.regionId}`;
            bodyContent = <h1>Placeholder</h1>;
        }

        return (
            <DraggableDialogComponent dialogProps={dialogProps} defaultWidth={600} defaultHeight={400} minHeight={300} minWidth={400} enableResizing={true}>
                <div className={Classes.DIALOG_BODY}>
                    {bodyContent}
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <AnchorButton intent={Intent.SUCCESS} onClick={appStore.hideRegionDialog} text="Apply"/>
                        <AnchorButton intent={Intent.NONE} onClick={appStore.hideRegionDialog} text="Close"/>
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}