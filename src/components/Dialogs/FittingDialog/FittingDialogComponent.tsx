import * as React from "react";
import {observer} from "mobx-react";
import {action, computed, makeObservable, observable} from "mobx";
import {AnchorButton, Classes, FormGroup, HTMLSelect, IDialogProps, Intent, NonIdealState, Position, Pre, Text} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import classNames from "classnames";
import {CARTA} from "carta-protobuf";
import {Point2D} from "models";
import {AppStore, FrameStore} from "stores";
import {ACTIVE_FILE_ID} from "stores/widgets";
import {DraggableDialogComponent} from "components/Dialogs";
import {SafeNumericInput} from "components/Shared";
import "./FittingDialogComponent.scss";

@observer
export class FittingDialogComponent extends React.Component {

    @observable selectedFileId: number;
    @observable center: Point2D;
    @observable amplitude: number;
    @observable majorAxis: number;
    @observable minorAxis: number;
    @observable pa: number;

    @action setSelectedFileId = (id: number) => {
        this.selectedFileId = id;
    }

    @action setCenterX = (val: number) => {
        this.center.x = val;
    };

    @action setCenterY = (val: number) => {
        this.center.y = val;
    };

    @action setAmplitude = (val: number) => {
        this.amplitude = val;
    };

    @action setMajorAxis = (val: number) => {
        this.majorAxis = val;
    };

    @action setMinorAxis = (val: number) => {
        this.minorAxis = val;
    };

    @action setPa = (val: number) => {
        this.pa = val;
    };

    @action clearParams = () => {
        this.center = {x: null, y: null};
        this.amplitude = null;
        this.majorAxis = null;
        this.minorAxis = null;
        this.pa = null;
    };

    @computed get effectiveFrame(): FrameStore {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame && appStore.frames?.length > 0) {
            return this.selectedFileId === ACTIVE_FILE_ID ? appStore.activeFrame : (appStore.getFrame(this.selectedFileId) ?? appStore.activeFrame);
        }
        return null;
    }

    @computed get fitDisabled() {
        const validFileId = this.effectiveFrame?.frameInfo && this.effectiveFrame?.frameInfo?.fileId >= 0;
        const validParams = Number.isFinite(this.center.x) && Number.isFinite(this.center.y) && Number.isFinite(this.amplitude) && Number.isFinite(this.majorAxis) && Number.isFinite(this.minorAxis) && Number.isFinite(this.pa);
        return !(validFileId && validParams);
    }

    constructor(props: any) {
        super(props);
        makeObservable(this);
        this.selectedFileId = ACTIVE_FILE_ID;
        this.clearParams();
    }

    private fitImage = () => {
        if (this.fitDisabled) {
            return;
        }

        const message: CARTA.IFittingRequest = {
            fileId: this.effectiveFrame.frameInfo.fileId,
            regionId: 0,
            estimates: `${this.amplitude}, ${this.center.x}, ${this.center.y}, ${this.majorAxis}arcsec, ${this.minorAxis}arcsec, ${this.pa}deg`
        };
        AppStore.Instance.requestFitting(message);
    };

    render() {
        const appStore = AppStore.Instance;
        
        const dialogProps: IDialogProps = {
            icon: "regression-chart",
            className: "fitting-dialog",
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.dialogStore.fittingDialogVisible,
            onClose: appStore.dialogStore.hideFittingDialog,
            title: "Image Fitting"
        };

        if (!appStore || appStore.frameNum <= 0 || !this.effectiveFrame) {
            return (
                <DraggableDialogComponent dialogProps={dialogProps} minWidth={200} minHeight={140} defaultWidth={600} defaultHeight={660} enableResizing={true}>
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />
                </DraggableDialogComponent>
            );
        }
        
        return (
            <DraggableDialogComponent dialogProps={dialogProps} minWidth={200} minHeight={140} defaultWidth={600} defaultHeight={660} enableResizing={true}>
                <div className={Classes.DIALOG_BODY}>
                    <FormGroup label="Data Source" inline={true}>
                        <HTMLSelect
                            value={this.selectedFileId}
                            options={[{value: ACTIVE_FILE_ID, label: "Active"}, ...(appStore.frameNames ?? [])]}
                            onChange={ev => this.setSelectedFileId(parseInt(ev.target.value))}
                        />
                    </FormGroup>
                    <FormGroup label="Center" inline={true} labelInfo="(px)">
                        <SafeNumericInput
                            value={this.center?.x ?? ""}
                            onValueChange={this.setCenterX}
                            buttonPosition="none"
                            placeholder="Center X"
                        />
                        <SafeNumericInput
                            value={this.center?.y ?? ""}
                            onValueChange={this.setCenterY}
                            buttonPosition="none"
                            placeholder="Center Y"
                        />
                    </FormGroup>
                    <FormGroup label="Amplitude" inline={true} labelInfo={`(${this.effectiveFrame?.unit})`}>
                        <SafeNumericInput
                            value={this.amplitude ?? ""}
                            onValueChange={this.setAmplitude}
                            buttonPosition="none"
                            placeholder="Amplitude"
                        />
                    </FormGroup>
                    <FormGroup label="FWHM" inline={true} labelInfo="(arcsec)">
                        <SafeNumericInput
                            value={this.majorAxis ?? ""}
                            onValueChange={this.setMajorAxis}
                            buttonPosition="none"
                            placeholder="Major Axis"
                        />
                        <SafeNumericInput
                            value={this.minorAxis ?? ""}
                            onValueChange={this.setMinorAxis}
                            buttonPosition="none"
                            placeholder="Minor Axis"
                        />
                    </FormGroup>
                    <FormGroup label="P.A." inline={true} labelInfo="(deg)">
                        <SafeNumericInput
                            value={this.pa ?? ""}
                            onValueChange={this.setPa}
                            buttonPosition="none"
                            placeholder="Position Angle"
                        />
                    </FormGroup>
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <Tooltip2 content="Clear fitting parameters." position={Position.BOTTOM}>
                            <AnchorButton intent={Intent.WARNING} onClick={this.clearParams} text="Clear" />
                        </Tooltip2>
                        <Tooltip2 content="Clear existing fitting results and fit the current channel of the image." position={Position.BOTTOM}>
                            <AnchorButton intent={Intent.PRIMARY} onClick={this.fitImage} text="Fit" disabled={this.fitDisabled}/>
                        </Tooltip2>
                    </div>
                </div>
                <div className={classNames(Classes.DIALOG_BODY, "fitting-result-form")}>
                    <FormGroup label="Fitting Result" inline={true}>
                        <div className="fitting-result">
                            <Pre className="fitting-result-pre">
                                <Text className="fitting-result-text">{this.effectiveFrame?.fittingResult ?? ""}</Text>
                            </Pre>
                        </div>
                    </FormGroup>
                </div>
            </DraggableDialogComponent>
        );
    }
}