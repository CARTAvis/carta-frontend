import {action, observable, makeObservable, computed} from "mobx";
import {CARTA} from "carta-protobuf";
import {AppStore, NumberFormatType} from "stores";
import {FrameStore} from "stores/Frame";
import {ACTIVE_FILE_ID} from "stores/widgets";
import {AngularSize, AngularSizeUnit, Point2D} from "models";
import {getFormattedWCSPoint, toExponential} from "utilities";

export class ImageFittingStore {
    private static staticInstance: ImageFittingStore;

    static get Instance() {
        if (!ImageFittingStore.staticInstance) {
            ImageFittingStore.staticInstance = new ImageFittingStore();
        }
        return ImageFittingStore.staticInstance;
    }

    @observable selectedFileId: number;
    @observable components: ImageFittingIndividualStore[];
    @observable selectedComponentIndex: number;
    @observable isFitting: boolean;

    @action setSelectedFileId = (id: number) => {
        this.selectedFileId = id;
    };

    @action setComponents = (num: number) => {
        if (num > this.components.length) {
            for (let i = this.components.length; i < num; i++) {
                this.components.push(new ImageFittingIndividualStore());
                this.selectedComponentIndex = this.components.length - 1;
            }
        } else if (num < this.components.length) {
            this.components = this.components.slice(0, num);
            if (this.selectedComponentIndex >= this.components.length) {
                this.selectedComponentIndex = this.components.length - 1;
            }
        }
    };

    @action clearComponents = () => {
        this.components = [new ImageFittingIndividualStore()];
        this.selectedComponentIndex = 0;
    };

    @action deleteSelectedComponent = () => {
        if (this.components.length > 1) {
            this.components.splice(this.selectedComponentIndex, 1);
            this.selectedComponentIndex = this.selectedComponentIndex === 0 ? 0 : this.selectedComponentIndex - 1;
        }
    };

    @action setSelectedComponentIndex = (index: number) => {
        this.selectedComponentIndex = index;
    };

    @action setIsFitting = (isFitting: boolean) => {
        this.isFitting = isFitting;
    };

    @computed get frameOptions() {
        return [{value: ACTIVE_FILE_ID, label: "Active"}, ...(AppStore.Instance.frameNames ?? [])];
    }

    @computed get effectiveFrame(): FrameStore {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame && appStore.frames?.length > 0) {
            return this.selectedFileId === ACTIVE_FILE_ID ? appStore.activeFrame : appStore.getFrame(this.selectedFileId) ?? appStore.activeFrame;
        }
        return null;
    }

    @computed get fitDisabled() {
        const validFileId = this.effectiveFrame?.frameInfo && this.effectiveFrame?.frameInfo?.fileId >= 0;
        const validParams = this.components.every(c => c.validParams === true);
        return !(validFileId && validParams) || this.isFitting;
    }

    constructor() {
        makeObservable(this);
        this.selectedFileId = ACTIVE_FILE_ID;
        this.clearComponents();
        this.selectedComponentIndex = 0;
    }

    fitImage = () => {
        if (this.fitDisabled) {
            return;
        }
        this.setIsFitting(true);
        const initialValues = [];
        for (const c of this.components) {
            initialValues.push({
                center: c.center,
                amp: c.amplitude,
                fwhm: c.fwhm,
                pa: c.pa
            });
        }

        const message: CARTA.IFittingRequest = {
            fileId: this.effectiveFrame.frameInfo.fileId,
            initialValues: initialValues,
            fixedParams: []
        };
        AppStore.Instance.requestFitting(message);
    };

    setResultString = (values: CARTA.IGaussianComponent[], errors: CARTA.IGaussianComponent[], log: string) => {
        const frame = this.effectiveFrame;
        if (!frame || !values || !errors) {
            return;
        }

        let results = "";
        log += "\n";
        const toFixFormat = (param: string, value: number | string, error: number, unit: string): string => {
            return `${param} = ${typeof value === "string" ? value : value?.toFixed(6)} +/- ${error?.toFixed(6)}${unit ? ` (${unit})` : ""}\n`;
        };
        const toExpFormat = (param: string, value: number | string, error: number, unit: string): string => {
            return `${param} = ${typeof value === "string" ? value : toExponential(value, 12)} +/- ${toExponential(error, 12)}${unit ? ` (${unit})` : ""}\n`;
        };
        const isFormatXDeg = AppStore.Instance.overlayStore.numbers?.formatTypeX === NumberFormatType.Degrees;
        const isFormatYDeg = AppStore.Instance.overlayStore.numbers?.formatTypeY === NumberFormatType.Degrees;

        for (let i = 0; i < values.length; i++) {
            const value = values[i];
            const error = errors[i];
            if (!value || !error) {
                continue;
            }
            results += `Component #${i + 1}:\n`;
            log += `Component #${i + 1}:\n`;
            if (!frame.wcsInfoForTransformation || !frame.pixelUnitSizeArcsec) {
                results += toFixFormat("Center X       ", value.center?.x, error.center?.x, "px");
                results += toFixFormat("Center Y       ", value.center?.y, error.center?.y, "px");
                results += toFixFormat("Amplitude      ", value.amp, error.amp, frame.requiredUnit);
                results += toFixFormat("FWHM Major Axis", value.fwhm?.x, error.fwhm?.x, "px");
                results += toFixFormat("FWHM Minor Axis", value.fwhm?.y, error.fwhm?.y, "px");
                results += toFixFormat("P.A.           ", value.pa, error.pa, "deg");

                log += toExpFormat("Center X       ", value.center?.x, error.center?.x, "px");
                log += toExpFormat("Center Y       ", value.center?.y, error.center?.y, "px");
                log += toExpFormat("Amplitude      ", value.amp, error.amp, frame.requiredUnit);
                log += toExpFormat("FWHM Major Axis", value.fwhm?.x, error.fwhm?.x, "px");
                log += toExpFormat("FWHM Minor Axis", value.fwhm?.y, error.fwhm?.y, "px");
                log += toExpFormat("P.A.           ", value.pa, error.pa, "deg");
            } else {
                const centerValueWCS = getFormattedWCSPoint(frame.wcsInfoForTransformation, value.center as Point2D);
                if (isFormatXDeg) {
                    centerValueWCS.x += " (deg)";
                }
                if (isFormatYDeg) {
                    centerValueWCS.y += " (deg)";
                }
                const centerErrorWCS = frame.getWcsSizeInArcsec(error.center as Point2D);

                let fwhmValueWCS = frame.getWcsSizeInArcsec(value.fwhm as Point2D);
                let fwhmErrorWCS = frame.getWcsSizeInArcsec(error.fwhm as Point2D);
                let fwhmUnit = {x: AngularSizeUnit.ARCSEC, y: AngularSizeUnit.ARCSEC};
                if (fwhmValueWCS && fwhmErrorWCS) {
                    ({value: fwhmValueWCS.x, unit: fwhmUnit.x} = AngularSize.convertFromArcsec(fwhmValueWCS.x, true));
                    fwhmErrorWCS.x = AngularSize.convertValueFromArcsec(fwhmErrorWCS.x, fwhmUnit.x);
                    ({value: fwhmValueWCS.y, unit: fwhmUnit.y} = AngularSize.convertFromArcsec(fwhmValueWCS.y, true));
                    fwhmErrorWCS.y = AngularSize.convertValueFromArcsec(fwhmErrorWCS.y, fwhmUnit.y);
                }

                results += toFixFormat("Center X       ", centerValueWCS?.x, centerErrorWCS?.x, "arcsec");
                results += toFixFormat("Center Y       ", centerValueWCS?.y, centerErrorWCS?.y, "arcsec");
                results += toFixFormat("Amplitude      ", value.amp, error.amp, frame.requiredUnit);
                results += toFixFormat("FWHM Major Axis", fwhmValueWCS?.x, fwhmErrorWCS?.x, fwhmUnit.x);
                results += toFixFormat("FWHM Minor Axis", fwhmValueWCS?.y, fwhmErrorWCS?.y, fwhmUnit.y);
                results += toFixFormat("P.A.           ", value.pa, error.pa, "deg");

                log += toExpFormat("Center X       ", centerValueWCS?.x, centerErrorWCS?.x, "arcsec");
                log += toExpFormat("               ", value.center?.x, error.center?.x, "px");
                log += toExpFormat("Center Y       ", centerValueWCS?.y, centerErrorWCS?.y, "arcsec");
                log += toExpFormat("               ", value.center?.y, error.center?.y, "px");
                log += toExpFormat("Amplitude      ", value.amp, error.amp, frame.requiredUnit);
                log += toExpFormat("FWHM Major Axis", fwhmValueWCS?.x, fwhmErrorWCS?.x, fwhmUnit.x);
                log += toExpFormat("               ", value.fwhm?.x, error.fwhm?.x, "px");
                log += toExpFormat("FWHM Minor Axis", fwhmValueWCS?.y, fwhmErrorWCS?.y, fwhmUnit.y);
                log += toExpFormat("               ", value.fwhm?.y, error.fwhm?.y, "px");
                log += toExpFormat("P.A.           ", value.pa, error.pa, "deg");
            }
            if (i !== values.length - 1) {
                results += "\n";
                log += "\n";
            }
        }

        frame.setFittingResult(results);
        frame.setFittingLog(log);
    };
}

export class ImageFittingIndividualStore {
    @observable center: Point2D;
    @observable amplitude: number;
    @observable fwhm: Point2D;
    @observable pa: number;

    @action setCenterX = (val: number) => {
        this.center.x = val;
    };

    @action setCenterY = (val: number) => {
        this.center.y = val;
    };

    @action setAmplitude = (val: number) => {
        this.amplitude = val;
    };

    @action setFwhmX = (val: number) => {
        this.fwhm.x = val;
    };

    @action setFwhmY = (val: number) => {
        this.fwhm.y = val;
    };

    @action setPa = (val: number) => {
        this.pa = val;
    };

    constructor() {
        makeObservable(this);
        this.center = {x: NaN, y: NaN};
        this.amplitude = NaN;
        this.fwhm = {x: NaN, y: NaN};
        this.pa = NaN;
    }

    @computed get validParams() {
        return isFinite(this.center?.x) && isFinite(this.center?.y) && isFinite(this.amplitude) && isFinite(this.fwhm?.x) && isFinite(this.fwhm?.y) && isFinite(this.pa);
    }
}
