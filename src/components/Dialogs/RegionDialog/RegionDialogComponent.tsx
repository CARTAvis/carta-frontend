import * as React from "react";
import {observer} from "mobx-react";
import {autorun, computed, observable} from "mobx";
import {AnchorButton, Classes, IDialogProps, Intent, NonIdealState} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {DraggableDialogComponent} from "components/Dialogs";
import {PointRegionForm} from "./PointRegionForm/PointRegionForm";
import {AppStore, RegionStore} from "stores";
import "./RegionDialogComponent.css";
import {RectangularRegionForm} from "./RectangularRegionForm/RectangularRegionForm";
import {EllipticalRegionForm} from "./EllipticalRegionForm/EllipticalRegionForm";

@observer
export class RegionDialogComponent extends React.Component<{ appStore: AppStore }> {

    @observable selectedRegion: RegionStore;
    @observable regionCopy: RegionStore;

    @computed get canApplyChanges() {
        // Can't apply changes to invalid objects
        if (!this.selectedRegion || !this.regionCopy || !this.selectedRegion.isValid || !this.regionCopy.isValid) {
            return false;
        }

        // Shallow check for changed values
        if (this.selectedRegion.name !== this.regionCopy.name || this.selectedRegion.channelMin !== this.regionCopy.channelMin || this.selectedRegion.channelMax !== this.regionCopy.channelMax ||
            this.selectedRegion.rotation !== this.regionCopy.rotation) {
            return true;
        }

        // Check array lengths
        if (this.selectedRegion.controlPoints.length !== this.regionCopy.controlPoints.length || this.selectedRegion.stokesValues.length !== this.regionCopy.stokesValues.length) {
            return true;
        }

        // Check array content
        for (let i = 0; i < this.selectedRegion.controlPoints.length; i++) {
            const a = this.selectedRegion.controlPoints[i];
            const b = this.regionCopy.controlPoints[i];
            if (a.x !== b.x || a.y !== b.y) {
                return true;
            }
        }

        for (let i = 0; i < this.selectedRegion.stokesValues.length; i++) {
            if (this.selectedRegion.stokesValues[i] !== this.regionCopy.stokesValues[i]) {
                return true;
            }
        }
        return false;
    }

    constructor(props: any) {
        super(props);

        autorun(() => {
            if (this.props.appStore.activeFrame && this.props.appStore.regionDialogVisible) {
                this.selectedRegion = this.props.appStore.activeFrame.regionSet.selectedRegion;
                if (this.selectedRegion) {
                    if (!this.regionCopy || this.selectedRegion.regionId !== this.regionCopy.regionId) {
                        console.log("Creating a copy of selected region for editing");
                        this.regionCopy = this.selectedRegion.getCopy();
                        this.regionCopy.beginEditing();
                    }
                } else {
                    this.regionCopy = null;

                }
            } else {
                this.selectedRegion = null;
                this.regionCopy = null;
            }
        });
    }

    private applyChanges = () => {
        if (this.selectedRegion && this.regionCopy) {
            this.selectedRegion.beginEditing();
            this.selectedRegion.applyUpdate(this.regionCopy);
            this.selectedRegion.endEditing();
        }
        this.props.appStore.hideRegionDialog();
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
            const region = this.regionCopy;
            if (region) {
                dialogProps.title = `Editing ${region.nameString}`;
                switch (region.regionType) {
                    case CARTA.RegionType.POINT:
                        bodyContent = <PointRegionForm region={region}/>;
                        break;
                    case CARTA.RegionType.RECTANGLE:
                        bodyContent = <RectangularRegionForm region={region}/>;
                        break;
                    case CARTA.RegionType.ELLIPSE:
                        bodyContent = <EllipticalRegionForm region={region}/>;
                        break;
                    default:
                        bodyContent = <h1>Placeholder</h1>;
                }
            } else {
                bodyContent = <h1>Placeholder</h1>;
            }
        }

        return (
            <DraggableDialogComponent dialogProps={dialogProps} defaultWidth={600} defaultHeight={400} minHeight={300} minWidth={400} enableResizing={true}>
                <div className={Classes.DIALOG_BODY}>
                    {bodyContent}
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <AnchorButton intent={Intent.SUCCESS} onClick={this.applyChanges} text="Apply"/>
                        <AnchorButton intent={Intent.NONE} onClick={appStore.hideRegionDialog} text="Close"/>
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}