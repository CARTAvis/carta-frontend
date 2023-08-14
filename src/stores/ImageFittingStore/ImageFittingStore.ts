import {CARTA} from "carta-protobuf";
import {action, computed, makeObservable, observable, reaction} from "mobx";

import {AppToaster, SuccessToast} from "components/Shared";
import {AngularSize, AngularSizeUnit, Point2D, WCSPoint2D} from "models";
import {AppStore, NumberFormatType} from "stores";
import {FrameStore, RegionStore, WCS_PRECISION} from "stores/Frame";
import {ACTIVE_FILE_ID} from "stores/Widgets";
import {angle2D, formattedArcsec, getFormattedWCSPoint, getPixelValueFromWCS, getValueFromArcsecString, isWCSStringFormatValid, pointDistance, rotate2D, scale2D, subtract2D, toExponential} from "utilities";

const FOV_REGION_ID = 0;
const IMAGE_REGION_ID = -1;

export class ImageFittingStore {
    private static staticInstance: ImageFittingStore;

    static get Instance() {
        if (!ImageFittingStore.staticInstance) {
            ImageFittingStore.staticInstance = new ImageFittingStore();
        }
        return ImageFittingStore.staticInstance;
    }

    @observable selectedFileId: number = ACTIVE_FILE_ID;
    @observable selectedRegionId: number = FOV_REGION_ID;
    @observable components: ImageFittingIndividualStore[];
    @observable selectedComponentIndex: number;
    @observable backgroundOffset: number = 0;
    @observable backgroundOffsetFixed: boolean = true;
    @observable solverType: CARTA.FittingSolverType = CARTA.FittingSolverType.Cholesky;
    @observable createModelImage: boolean = true;
    @observable createResidualImage: boolean = true;
    @observable isFitting: boolean = false;
    @observable progress: number = 0;
    @observable isCancelling: boolean = false;

    @action setSelectedFileId = (id: number) => {
        this.selectedFileId = id;
    };

    @action setSelectedRegionId = (id: number) => {
        this.selectedRegionId = id;
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
        this.backgroundOffset = 0;
        this.solverType = CARTA.FittingSolverType.Cholesky;
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

    @action setBackgroundOffset = (offset: number) => {
        if (isFinite(offset)) {
            this.backgroundOffset = offset;
        }
    };

    @action resetBackgroundOffset = () => {
        this.backgroundOffset = 0;
    };

    @action toggleBackgroundOffsetFixed = () => {
        this.backgroundOffsetFixed = !this.backgroundOffsetFixed;
    };

    @action setSolverType = (type: CARTA.FittingSolverType) => {
        this.solverType = type;
    };

    @action toggleCreateModelImage = () => {
        this.createModelImage = !this.createModelImage;
    };

    @action toggleCreateResidualImage = () => {
        this.createResidualImage = !this.createResidualImage;
    };

    @action setIsFitting = (isFitting: boolean) => {
        this.isFitting = isFitting;
    };

    @action setProgress = (progress: number) => {
        this.progress = progress;
    };

    @action setIsCancelling = (isCancelling: boolean) => {
        this.isCancelling = isCancelling;
    };

    @action resetFittingState = () => {
        this.isFitting = false;
        this.progress = 0;
        this.isCancelling = false;
    };

    @computed get frameOptions() {
        return [{value: ACTIVE_FILE_ID, label: "Active"}, ...(AppStore.Instance.frameNames ?? [])];
    }

    @computed get regionOptions() {
        const closedRegions = this.effectiveFrame?.regionSet?.regions.filter(r => !r.isTemporary && r.isClosedRegion);
        const options = closedRegions?.map(r => {
            return {value: r.regionId, label: r.nameString};
        });
        return [{value: FOV_REGION_ID, label: "Field of view"}, {value: IMAGE_REGION_ID, label: "Image"}, ...(options ?? [])];
    }

    // Mcholesky is not supported because it's not available in all gsl versions
    get solverOptions() {
        return [
            {value: CARTA.FittingSolverType.Qr, label: "QR"},
            {value: CARTA.FittingSolverType.Cholesky, label: "Cholesky"},
            {value: CARTA.FittingSolverType.Svd, label: "SVD"}
        ];
    }

    @computed get effectiveFrame(): FrameStore {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame && appStore.frames?.length > 0) {
            return this.selectedFileId === ACTIVE_FILE_ID ? appStore.activeFrame : appStore.getFrame(this.selectedFileId) ?? appStore.activeFrame;
        }
        return null;
    }

    @computed get fitDisabled() {
        const fileId = this.effectiveFrame?.frameInfo?.fileId;
        const validFileId = isFinite(fileId) && fileId >= 0;
        const allFixed = this.components.every(c => c.allFixed === true);
        const validParams = this.components.every(c => c.validParams === true);
        return !validFileId || allFixed || !validParams || this.isFitting;
    }

    constructor() {
        makeObservable(this);
        this.clearComponents();

        reaction(
            () => this.regionOptions,
            options => {
                if (options && !options.map(x => x.value)?.includes(this.selectedRegionId)) {
                    this.setSelectedRegionId(FOV_REGION_ID);
                }
            }
        );
    }

    fitImage = () => {
        if (this.fitDisabled) {
            return;
        }
        this.setIsFitting(true);
        this.setIsCancelling(false);
        const initialValues: CARTA.IGaussianComponent[] = [];
        const fixedParams: boolean[] = [];
        for (const c of this.components) {
            initialValues.push({
                center: c.center,
                amp: c.amplitude,
                fwhm: c.fwhm,
                pa: c.pa
            });
            fixedParams.push(...c.fixedParams);
        }
        fixedParams.push(this.backgroundOffsetFixed);

        let fovInfo: CARTA.IRegionInfo | null = null;
        let regionId = this.selectedRegionId;
        if (regionId === FOV_REGION_ID) {
            fovInfo = this.getFovInfo();
            regionId = fovInfo ? FOV_REGION_ID : IMAGE_REGION_ID;
        }

        const message: CARTA.IFittingRequest = {
            fileId: this.effectiveFrame.frameInfo.fileId,
            initialValues,
            fixedParams,
            regionId,
            fovInfo,
            createModelImage: this.createModelImage,
            createResidualImage: this.createResidualImage,
            offset: this.backgroundOffset,
            solver: this.solverType
        };
        AppStore.Instance.requestFitting(message);
    };

    cancelFitting = () => {
        this.setIsCancelling(true);
        if (this.progress < 1.0 && this.isFitting) {
            AppStore.Instance.backendService?.cancelRequestingFitting(this.effectiveFrame.frameInfo.fileId);
        }
    };

    setResultString = (
        regionId: number,
        fovInfo: CARTA.IRegionInfo,
        fixedParams: boolean[],
        values: CARTA.IGaussianComponent[],
        errors: CARTA.IGaussianComponent[],
        offsetValue: number,
        offsetError: number,
        integratedFluxValues: number[],
        integratedFluxErrors: number[],
        fittingLog: string
    ) => {
        const frame = this.effectiveFrame;
        if (!frame || !values || !errors) {
            return;
        }

        let results = "";
        let log = "";

        log += `Image: ${frame.filename}\n`;
        log += this.getRegionInfoLog(regionId, fovInfo) + "\n";
        log += fittingLog + "\n";

        const toFixFormat = (param: string, value: number | string, error: number, unit: string, fixed: boolean): string => {
            const valueString = typeof value === "string" ? value : value?.toFixed(6);
            const errorString = fixed ? "" : " \u00b1 " + error?.toFixed(6);
            return `${param} = ${valueString}${errorString}${unit ? ` (${unit})` : ""}${fixed ? " (fixed)" : ""}\n`;
        };
        const toExpFormat = (param: string, value: number | string, error: number, unit: string, fixed: boolean): string => {
            const valueString = typeof value === "string" ? value : toExponential(value, 12);
            const errorString = fixed ? "" : " \u00b1 " + toExponential(error, 12);
            return `${param} = ${valueString}${errorString}${unit ? ` (${unit})` : ""}${fixed ? " (fixed)" : ""}\n`;
        };
        const isFormatXDeg = AppStore.Instance.overlayStore.numbers?.formatTypeX === NumberFormatType.Degrees;
        const isFormatYDeg = AppStore.Instance.overlayStore.numbers?.formatTypeY === NumberFormatType.Degrees;
        const showIntegratedFlux = integratedFluxValues.length === values.length && integratedFluxErrors.length === values.length && (frame.requiredUnit === "Jy/pixel" || frame.requiredUnit === "Jy/beam");

        for (let i = 0; i < values.length; i++) {
            const value = values[i];
            const error = errors[i];
            if (!value || !error) {
                continue;
            }
            results += `Component #${i + 1}:\n`;
            log += `Component #${i + 1}:\n`;
            const [centerFixedX, centerFixedY, amplitudeFixed, fwhmFixedX, fwhmFixedY, paFixed] = fixedParams.slice(i * 6, i * 6 + 6);
            if (!frame.wcsInfoForTransformation || !frame.pixelUnitSizeArcsec) {
                results += toFixFormat("Center X       ", value.center?.x, error.center?.x, "px", centerFixedX);
                results += toFixFormat("Center Y       ", value.center?.y, error.center?.y, "px", centerFixedY);
                results += toFixFormat("Amplitude      ", value.amp, error.amp, frame.requiredUnit, amplitudeFixed);
                results += toFixFormat("FWHM Major Axis", value.fwhm?.x, error.fwhm?.x, "px", fwhmFixedX);
                results += toFixFormat("FWHM Minor Axis", value.fwhm?.y, error.fwhm?.y, "px", fwhmFixedY);
                results += toFixFormat("P.A.           ", value.pa, error.pa, "deg", paFixed);
                if (showIntegratedFlux) {
                    results += toFixFormat("Integrated flux", integratedFluxValues[i], integratedFluxErrors[i], "Jy", amplitudeFixed && fwhmFixedX && fwhmFixedY);
                }

                log += toExpFormat("Center X       ", value.center?.x, error.center?.x, "px", centerFixedX);
                log += toExpFormat("Center Y       ", value.center?.y, error.center?.y, "px", centerFixedY);
                log += toExpFormat("Amplitude      ", value.amp, error.amp, frame.requiredUnit, amplitudeFixed);
                log += toExpFormat("FWHM Major Axis", value.fwhm?.x, error.fwhm?.x, "px", fwhmFixedX);
                log += toExpFormat("FWHM Minor Axis", value.fwhm?.y, error.fwhm?.y, "px", fwhmFixedY);
                log += toExpFormat("P.A.           ", value.pa, error.pa, "deg", paFixed);
                if (showIntegratedFlux) {
                    log += toExpFormat("Integrated flux", integratedFluxValues[i], integratedFluxErrors[i], "Jy", amplitudeFixed && fwhmFixedX && fwhmFixedY);
                }
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
                let fwhmUnit = AngularSizeUnit.ARCSEC;
                if (fwhmValueWCS && fwhmErrorWCS) {
                    if (Math.abs(fwhmValueWCS.x) < Math.abs(fwhmValueWCS.y)) {
                        ({value: fwhmValueWCS.x, unit: fwhmUnit} = AngularSize.convertFromArcsec(fwhmValueWCS.x, true));
                        fwhmValueWCS.y = AngularSize.convertValueFromArcsec(fwhmValueWCS.y, fwhmUnit);
                    } else {
                        ({value: fwhmValueWCS.y, unit: fwhmUnit} = AngularSize.convertFromArcsec(fwhmValueWCS.y, true));
                        fwhmValueWCS.x = AngularSize.convertValueFromArcsec(fwhmValueWCS.x, fwhmUnit);
                    }
                    fwhmErrorWCS.x = AngularSize.convertValueFromArcsec(fwhmErrorWCS.x, fwhmUnit);
                    fwhmErrorWCS.y = AngularSize.convertValueFromArcsec(fwhmErrorWCS.y, fwhmUnit);
                }

                results += toFixFormat("Center X       ", centerValueWCS?.x, centerErrorWCS?.x, centerFixedX ? "" : "arcsec", centerFixedX);
                results += toFixFormat("Center Y       ", centerValueWCS?.y, centerErrorWCS?.y, centerFixedY ? "" : "arcsec", centerFixedY);
                results += toFixFormat("Amplitude      ", value.amp, error.amp, frame.requiredUnit, amplitudeFixed);
                results += toFixFormat("FWHM Major Axis", fwhmValueWCS?.x, fwhmErrorWCS?.x, fwhmUnit, fwhmFixedX);
                results += toFixFormat("FWHM Minor Axis", fwhmValueWCS?.y, fwhmErrorWCS?.y, fwhmUnit, fwhmFixedY);
                results += toFixFormat("P.A.           ", value.pa, error.pa, "deg", paFixed);
                if (showIntegratedFlux) {
                    results += toFixFormat("Integrated flux", integratedFluxValues[i], integratedFluxErrors[i], "Jy", amplitudeFixed && fwhmFixedX && fwhmFixedY);
                }

                log += toExpFormat("Center X       ", centerValueWCS?.x, centerErrorWCS?.x, centerFixedX ? "" : "arcsec", centerFixedX);
                log += toExpFormat("               ", value.center?.x, error.center?.x, "px", centerFixedX);
                log += toExpFormat("Center Y       ", centerValueWCS?.y, centerErrorWCS?.y, centerFixedY ? "" : "arcsec", centerFixedY);
                log += toExpFormat("               ", value.center?.y, error.center?.y, "px", centerFixedY);
                log += toExpFormat("Amplitude      ", value.amp, error.amp, frame.requiredUnit, amplitudeFixed);
                log += toExpFormat("FWHM Major Axis", fwhmValueWCS?.x, fwhmErrorWCS?.x, fwhmUnit, fwhmFixedX);
                log += toExpFormat("               ", value.fwhm?.x, error.fwhm?.x, "px", fwhmFixedX);
                log += toExpFormat("FWHM Minor Axis", fwhmValueWCS?.y, fwhmErrorWCS?.y, fwhmUnit, fwhmFixedY);
                log += toExpFormat("               ", value.fwhm?.y, error.fwhm?.y, "px", fwhmFixedY);
                log += toExpFormat("P.A.           ", value.pa, error.pa, "deg", paFixed);
                if (showIntegratedFlux) {
                    log += toExpFormat("Integrated flux", integratedFluxValues[i], integratedFluxErrors[i], "Jy", amplitudeFixed && fwhmFixedX && fwhmFixedY);
                }
            }
            results += "\n";
            log += "\n";
        }

        results += toFixFormat("Background     ", offsetValue, offsetError, frame.requiredUnit, fixedParams[fixedParams.length - 1]);
        log += toExpFormat("Background     ", offsetValue, offsetError, frame.requiredUnit, fixedParams[fixedParams.length - 1]);

        frame.setFittingResult(results);
        frame.setFittingLog(log);
        frame.setFittingResultRegionParams(this.getRegionParams(values));
    };

    createRegions = async () => {
        const preferenceStore = AppStore.Instance.preferenceStore;
        const defaultColor = preferenceStore?.regionColor;
        const defaultLineWidth = preferenceStore?.regionLineWidth;
        const defaultDashLength = [2];
        const params = this.effectiveFrame?.fittingResultRegionParams;
        try {
            await Promise.all(
                params.map((param, index) => {
                    const temporaryId = -1 - index;
                    const name = `Fitting result: Component #${index + 1}`;
                    const newRegion = this.effectiveFrame?.regionSet?.addExistingRegion(param.points.slice(), param.rotation, CARTA.RegionType.ELLIPSE, temporaryId, name, defaultColor, defaultLineWidth, defaultDashLength);
                    return newRegion.endCreating();
                })
            );
            AppToaster.show(SuccessToast("tick", `Created ${params.length} ellipse regions.`));
        } catch (err) {
            console.log(err);
        }
    };

    private getFovInfo = (): CARTA.IRegionInfo | null => {
        const frame = this.effectiveFrame;
        if (!frame) {
            return null;
        }

        // field of view of the effective frame or the base frame
        let rotation = 0;
        const baseFrame = frame.spatialReference ?? frame;
        let center = baseFrame.center;
        const pixelRatio = baseFrame.renderHiDPI ? devicePixelRatio * AppStore.Instance.imageRatio : 1.0;
        const imageWidth = (pixelRatio * baseFrame.renderWidth) / baseFrame.zoomLevel / baseFrame.aspectRatio;
        const imageHeight = (pixelRatio * baseFrame.renderHeight) / baseFrame.zoomLevel;
        let size = {x: imageWidth, y: imageHeight};

        // transform from the base frame to the effective frame
        if (frame.spatialReference) {
            if (frame.spatialTransform) {
                center = frame.spatialTransform.transformCoordinate(center, false);
                size = scale2D(size, 1.0 / frame.spatialTransform.scale);
                rotation = (-frame.spatialTransform.rotation * 180) / Math.PI;
            } else {
                console.log("failed to find fov of the matched image, fit the entire image instead");
                return null;
            }
        }

        // set region id to IMAGE_REGION_ID if fov includes the entire image
        const width = frame.frameInfo?.fileInfoExtended?.width;
        const height = frame.frameInfo?.fileInfoExtended?.height;
        const imageCorners: Point2D[] = [
            {x: -0.5, y: -0.5},
            {x: width - 0.5, y: -0.5},
            {x: -0.5, y: height - 0.5},
            {x: width - 0.5, y: height - 0.5}
        ];
        const fovXDir = rotate2D({x: 1, y: 0}, (rotation * Math.PI) / 180);
        let isEntireImage = true;
        for (const imageCorner of imageCorners) {
            const distToFovCenter = pointDistance(center, imageCorner);
            const projectionAngle = angle2D(fovXDir, subtract2D(center, imageCorner));
            const dx = distToFovCenter * Math.cos(projectionAngle);
            const dy = distToFovCenter * Math.sin(projectionAngle);
            const isOutsideFov = Math.abs(dx) - size.x * 0.5 > 1e-7 || Math.abs(dy) - size.y * 0.5 > 1e-7;
            if (isOutsideFov) {
                isEntireImage = false;
                break;
            }
        }
        if (isEntireImage) {
            return null;
        }

        const controlPoints = [center, size];
        const regionType = CARTA.RegionType.RECTANGLE;
        const regionInfo = {regionType, rotation, controlPoints};
        return regionInfo;
    };

    private getRegionInfoLog = (regionId: number, fovInfo: CARTA.IRegionInfo): string => {
        let log = "";
        switch (regionId) {
            case IMAGE_REGION_ID:
                log += "Region: entire image\n";
                break;
            case FOV_REGION_ID:
                log += "Region: field of view\n";
                if (fovInfo) {
                    log += RegionStore.GetRegionProperties(fovInfo.regionType, fovInfo.controlPoints as Point2D[], fovInfo.rotation) + "\n";
                    log += this.effectiveFrame?.genRegionWcsProperties(fovInfo.regionType, fovInfo.controlPoints as Point2D[], fovInfo.rotation) + "\n";
                }
                break;
            default:
                const region = this.effectiveFrame?.getRegion(regionId);
                if (region) {
                    log += `Region: ${region.nameString}\n`;
                    log += region.regionProperties + "\n";
                    log += this.effectiveFrame.getRegionWcsProperties(region) + "\n";
                }
                break;
        }
        return log;
    };

    private getRegionParams = (values: CARTA.IGaussianComponent[]): {points: Point2D[]; rotation: number}[] => {
        return values.map(value => {
            const center = {x: value?.center?.x, y: value?.center?.y};
            // Half lengths of major and minor axes are used to defined an ellipse region. Divide FWHM of Gaussian by 2.
            const size = {x: value?.fwhm?.x / 2.0, y: value?.fwhm?.y / 2.0};
            return {points: [center, size], rotation: value?.pa};
        });
    };
}

export class ImageFittingIndividualStore {
    @observable center: Point2D;
    @observable amplitude: number;
    @observable fwhm: Point2D;
    @observable pa: number;
    @observable centerFixed: {x: boolean; y: boolean};
    @observable amplitudeFixed: boolean;
    @observable fwhmFixed: {x: boolean; y: boolean};
    @observable paFixed: boolean;

    @action setCenterX = (val: number): boolean => {
        if (isFinite(val)) {
            this.center.x = val;
            return true;
        }
        return false;
    };

    @action setCenterY = (val: number): boolean => {
        if (isFinite(val)) {
            this.center.y = val;
            return true;
        }
        return false;
    };

    @action private setCenter = (center: Point2D): boolean => {
        if (isFinite(center?.x) && isFinite(center?.y)) {
            this.center = center;
            return true;
        }
        return false;
    };

    @action setAmplitude = (val: number): boolean => {
        if (isFinite(val)) {
            this.amplitude = val;
            return true;
        }
        return false;
    };

    @action setFwhmX = (val: number): boolean => {
        if (isFinite(val) && val > 0) {
            this.fwhm.x = val;
            return true;
        }
        return false;
    };

    @action setFwhmY = (val: number): boolean => {
        if (isFinite(val) && val > 0) {
            this.fwhm.y = val;
            return true;
        }
        return false;
    };

    @action setPa = (val: number): boolean => {
        if (isFinite(val)) {
            this.pa = val;
            return true;
        }
        return false;
    };

    @action toggleCenterXFixed = () => {
        this.centerFixed.x = !this.centerFixed.x;
    };

    @action toggleCenterYFixed = () => {
        this.centerFixed.y = !this.centerFixed.y;
    };

    @action toggleAmplitudeFixed = () => {
        this.amplitudeFixed = !this.amplitudeFixed;
    };

    @action toggleFwhmXFixed = () => {
        this.fwhmFixed.x = !this.fwhmFixed.x;
    };

    @action toggleFwhmYFixed = () => {
        this.fwhmFixed.y = !this.fwhmFixed.y;
    };

    @action togglePaFixed = () => {
        this.paFixed = !this.paFixed;
    };

    constructor() {
        makeObservable(this);
        this.center = {x: NaN, y: NaN};
        this.amplitude = NaN;
        this.fwhm = {x: NaN, y: NaN};
        this.pa = NaN;
        this.centerFixed = {x: false, y: false};
        this.amplitudeFixed = false;
        this.fwhmFixed = {x: false, y: false};
        this.paFixed = false;
    }

    @computed get centerWcs(): WCSPoint2D {
        // re-calculate with different wcs system
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const system = AppStore.Instance.overlayStore.global.explicitSystem;
        const wcsInfo = AppStore.Instance.imageFittingStore?.effectiveFrame?.wcsInfoForTransformation;
        if (!wcsInfo || !isFinite(this.center?.x) || !isFinite(this.center?.y)) {
            return null;
        }
        return getFormattedWCSPoint(wcsInfo, this.center);
    }

    @computed get fwhmWcs(): WCSPoint2D {
        const frame = AppStore.Instance.imageFittingStore?.effectiveFrame;
        const wcsSize = frame?.getWcsSizeInArcsec(this.fwhm);
        if (!wcsSize) {
            return null;
        }
        return {x: formattedArcsec(wcsSize.x, WCS_PRECISION), y: formattedArcsec(wcsSize.y, WCS_PRECISION)};
    }

    @computed get validParams(): boolean {
        return isFinite(this.center?.x) && isFinite(this.center?.y) && isFinite(this.amplitude) && isFinite(this.fwhm?.x) && isFinite(this.fwhm?.y) && isFinite(this.pa);
    }

    @computed get fixedParams(): boolean[] {
        return [this.centerFixed?.x, this.centerFixed?.y, this.amplitudeFixed, this.fwhmFixed?.x, this.fwhmFixed?.y, this.paFixed];
    }

    @computed get allFixed(): boolean {
        return this.fixedParams.every(p => p === true);
    }

    setCenterXWcs = (val: string): boolean => {
        if (!isWCSStringFormatValid(val, AppStore.Instance.overlayStore.numbers.formatTypeX)) {
            return false;
        }
        const wcsInfo = AppStore.Instance.imageFittingStore?.effectiveFrame?.wcsInfoForTransformation;
        if (!wcsInfo) {
            return false;
        }
        // initialize center Y with the wcs coordinate of the origin (0, 0) if center Y is not set yet
        // update center Y with the wcs coordinate of (0, center Y) if center Y is set and center X is not
        const centerYWcs = this.centerWcs?.y ?? getFormattedWCSPoint(wcsInfo, {x: 0, y: isFinite(this.center?.y) ? this.center?.y : 0})?.y;
        const center = getPixelValueFromWCS(wcsInfo, {x: val, y: centerYWcs});
        if (!center) {
            return false;
        }
        return this.setCenter(center);
    };

    setCenterYWcs = (val: string): boolean => {
        if (!isWCSStringFormatValid(val, AppStore.Instance.overlayStore.numbers.formatTypeY)) {
            return false;
        }
        const wcsInfo = AppStore.Instance.imageFittingStore?.effectiveFrame?.wcsInfoForTransformation;
        if (!wcsInfo) {
            return false;
        }
        // initialize center X with the wcs coordinate of origin (0, 0) if center X is not set yet
        // update center X with the wcs coordinate of (center X, 0) if center X is set and center Y is not
        const centerXWcs = this.centerWcs?.x ?? getFormattedWCSPoint(wcsInfo, {x: isFinite(this.center?.x) ? this.center?.x : 0, y: 0})?.x;
        const center = getPixelValueFromWCS(wcsInfo, {x: centerXWcs, y: val});
        if (!center) {
            return false;
        }
        return this.setCenter(center);
    };

    setFwhmXWcs = (val: string): boolean => {
        const frame = AppStore.Instance.imageFittingStore?.effectiveFrame;
        if (val && frame) {
            return this.setFwhmX(frame.getImageXValueFromArcsec(getValueFromArcsecString(val)));
        }
        return false;
    };

    setFwhmYWcs = (val: string): boolean => {
        const frame = AppStore.Instance.imageFittingStore?.effectiveFrame;
        if (val && frame) {
            return this.setFwhmY(frame.getImageYValueFromArcsec(getValueFromArcsecString(val)));
        }
        return false;
    };
}
