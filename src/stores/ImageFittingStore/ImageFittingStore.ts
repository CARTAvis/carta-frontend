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

/** Manages the state and logic for multiple Gaussian image fitting. */
export class ImageFittingStore {
    private static staticInstance: ImageFittingStore;

    static get Instance() {
        if (!ImageFittingStore.staticInstance) {
            ImageFittingStore.staticInstance = new ImageFittingStore();
        }
        return ImageFittingStore.staticInstance;
    }

    /** ID of the file currently selected for fitting. */
    @observable selectedFileId: number = ACTIVE_FILE_ID;
    /** ID of the region currently selected for fitting. Set to 0 for the current field of view, or -1 for the full image. */
    @observable selectedRegionId: number = FOV_REGION_ID;
    /** Stores the initial values and fixed flags for each Gaussian component. */
    @observable components: ImageFittingIndividualStore[];
    /** Indicates whether to auto‑generate initial values when requesting for fitting. */
    @observable isAutoInitVal: boolean = true;
    /** Index of the component currently selected in the UI. */
    @observable selectedComponentIndex: number;
    /** Constant background offset. */
    @observable backgroundOffset: number = 0;
    /** Indicates whether to fix the background offset when fitting. */
    @observable backgroundOffsetFixed: boolean = true;
    /** Solver used for fitting. */
    @observable solverType: CARTA.FittingSolverType = CARTA.FittingSolverType.Cholesky;
    /** Indicates whether to generate a model image when requesting for fitting. */
    @observable createModelImage: boolean = true;
    /** Indicates whether to generate a residual image when requesting for fitting. */
    @observable createResidualImage: boolean = true;
    /** Whether a fitting request is currently being processed. */
    @observable isFitting: boolean = false;
    /** Progress of the current fitting request, from 0 to 1 (multiply by 100 for %). */
    @observable progress: number = 0;
    /** Whether cancel is in progress. */
    @observable isCancelling: boolean = false;

    /**
     *  Sets the ID of the file currently selected for fitting.
     * @param id - The file ID.
     */
    @action setSelectedFileId = (id: number) => {
        this.selectedFileId = id;
    };

    /**
     * Sets the ID of the region currently selected for fitting.
     * @param id - The region ID (0 = current FOV, -1 = full image, positive number = specific region).
     */
    @action setSelectedRegionId = (id: number) => {
        this.selectedRegionId = id;
    };

    /**
     * Sets the number of components used for fitting.
     * @param num - The number of components.
     */
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

    /** Resets settings to defaults. */
    @action clearComponents = () => {
        this.components = [new ImageFittingIndividualStore()];
        this.selectedComponentIndex = 0;
        this.backgroundOffset = 0;
        this.solverType = CARTA.FittingSolverType.Cholesky;
    };

    /** Removes the currently selected component (if more than one remains). */
    @action deleteSelectedComponent = () => {
        if (this.components.length > 1) {
            this.components.splice(this.selectedComponentIndex, 1);
            this.selectedComponentIndex = this.selectedComponentIndex === 0 ? 0 : this.selectedComponentIndex - 1;
        }
    };

    /**
     * Enables or disables automatic initial‑value generation.
     * @param isAuto - True to enable, false to disable.
     */
    @action setIsAutoInitVal = (isAuto: boolean) => {
        this.isAutoInitVal = isAuto;
    };

    /**
     * Sets the index of the component currently selected in the UI.
     * @param index - The selected component index.
     */
    @action setSelectedComponentIndex = (index: number) => {
        this.selectedComponentIndex = index;
    };

    /**
     * Sets the constant background offset.
     * @param offset - Offset value (ignored if not finite).
     */
    @action setBackgroundOffset = (offset: number) => {
        if (isFinite(offset)) {
            this.backgroundOffset = offset;
        }
    };

    /** Resets the background offset to 0. */
    @action resetBackgroundOffset = () => {
        this.backgroundOffset = 0;
    };

    /** Toggles whether the background offset is fixed during fitting. */
    @action toggleBackgroundOffsetFixed = () => {
        this.backgroundOffsetFixed = !this.backgroundOffsetFixed;
    };

    /**
     * Sets the solver used for fitting.
     * @param type - A value from `CARTA.FittingSolverType`.
     */
    @action setSolverType = (type: CARTA.FittingSolverType) => {
        this.solverType = type;
    };

    /** Toggles whether to generate a model image when requesting for fitting.  */
    @action toggleCreateModelImage = () => {
        this.createModelImage = !this.createModelImage;
    };

    /** Toggles whether to generate a residual image when requesting for fitting. */
    @action toggleCreateResidualImage = () => {
        this.createResidualImage = !this.createResidualImage;
    };

    /**
     * Updates whether a fitting request is currently being processed.
     * @param isFitting - True when fitting is in progress.
     */
    @action setIsFitting = (isFitting: boolean) => {
        this.isFitting = isFitting;
    };

    /**
     * Sets the progress of the current fitting request.
     * @param progress - Progress from 0 to 1 (multiply by 100 for %).
     */
    @action setProgress = (progress: number) => {
        this.progress = progress;
    };

    /**
     * Updates whether cancel is in progress.
     * @param isCancelling - True if cancellation has been requested.
     */
    @action setIsCancelling = (isCancelling: boolean) => {
        this.isCancelling = isCancelling;
    };

    /** Resets the fitting states and progress. */
    @action resetFittingState = () => {
        this.isFitting = false;
        this.progress = 0;
        this.isCancelling = false;
    };

    /** The available file frame options for selection, including the active file. */
    @computed get frameOptions() {
        return [{value: ACTIVE_FILE_ID, label: "Active"}, ...(AppStore.Instance.frameNames ?? [])];
    }

    /** The available region options including the field of view, entire image, and all closed, non-temporary regions. */
    @computed get regionOptions() {
        const closedRegions = this.effectiveFrame?.regionSet?.regions.filter(r => !r.isTemporary && r.isClosedRegion);
        const options = closedRegions?.map(r => {
            return {value: r.regionId, label: r.nameString};
        });
        return [{value: FOV_REGION_ID, label: "Field of view"}, {value: IMAGE_REGION_ID, label: "Image"}, ...(options ?? [])];
    }

    /** Available fitting solver options shown in the UI. MCholesky is excluded because it is not supported in all GSL versions. */
    get solverOptions() {
        return [
            {value: CARTA.FittingSolverType.Qr, label: "QR"},
            {value: CARTA.FittingSolverType.Cholesky, label: "Cholesky"},
            {value: CARTA.FittingSolverType.Svd, label: "SVD"}
        ];
    }

    /** The frame used for fitting. */
    @computed get effectiveFrame(): FrameStore | null {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame && appStore.frames?.length > 0) {
            return this.selectedFileId === ACTIVE_FILE_ID ? appStore.activeFrame : (appStore.getFrame(this.selectedFileId) ?? appStore.activeFrame);
        }
        return null;
    }

    /** Whether all input initial values are valid. Returns true if automatic initial-value generation is enabled. */
    @computed get validParams() {
        return this.isAutoInitVal ? true : this.components.every(c => c.validParams === true);
    }

    /** The total number of fixed parameters across all Gaussian parameters. Returns 0 if automatic initial-value generation is enabled. */
    @computed get fixedParamsNum(): number {
        return this.isAutoInitVal ? 0 : this.components.reduce((sum, c) => sum + c.fixedParamNum, 0);
    }

    /** Whether fitting is disabled due to an invalid file ID, all parameters being fixed, invalid initial values, or fitting in progress. */
    @computed get fitDisabled() {
        const fileId = this.effectiveFrame?.frameInfo?.fileId;
        const validFileId = fileId !== undefined && isFinite(fileId) && fileId >= 0;
        const allFixed = this.components.every(c => c.allFixed === true);
        return !validFileId || allFixed || !this.validParams || this.isFitting;
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

    /**
     * Sends a fitting request using the current fitting settings.
     * If automatic initial-value generation is enabled, `NaN` values and `false` flags are used instead of {@link components}.
     * Skips the request if fitting is currently disabled.
     */
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
                center: this.isAutoInitVal ? {x: NaN, y: NaN} : c.center,
                amp: this.isAutoInitVal ? NaN : c.amplitude,
                fwhm: this.isAutoInitVal ? {x: NaN, y: NaN} : c.fwhm,
                pa: this.isAutoInitVal ? NaN : c.pa
            });
            fixedParams.push(...(this.isAutoInitVal ? [false, false, false, false, false, false] : c.fixedParams));
        }
        fixedParams.push(this.backgroundOffsetFixed);

        let fovInfo: CARTA.IRegionInfo | null = null;
        let regionId = this.selectedRegionId;
        if (regionId === FOV_REGION_ID) {
            fovInfo = this.getFovInfo();
            regionId = fovInfo ? FOV_REGION_ID : IMAGE_REGION_ID;
        }

        const message: CARTA.IFittingRequest = {
            fileId: this.effectiveFrame?.frameInfo.fileId,
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

    /** Cancels a fitting request if the progress is incomplete and updates the cancelling status. */
    cancelFitting = () => {
        this.setIsCancelling(true);
        if (this.progress < 1.0 && this.isFitting && this.effectiveFrame) {
            AppStore.Instance.backendService?.cancelRequestingFitting(this.effectiveFrame.frameInfo.fileId);
        }
    };

    /**
     * Processes the fitting results and stores the formatted result string and log messages.
     * @param regionId - The region ID used for fitting.
     * @param fovInfo - Field of view parameters when fitting was performed on the current FOV.
     * @param fixedParams - Fixed flags for each fitting parameters.
     * @param values - Values for each Gaussian component.
     * @param errors - Fitting errors for each Gaussian component.
     * @param offsetValue - The background offset.
     * @param offsetError - Fitting error of the background offset.
     * @param integratedFluxValues - Integrated flux values for each Gaussian component.
     * @param integratedFluxErrors - Errors of the integrated flux values.
     * @param fittingLog - The log message.
     */
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

        this.setGeneratedInitVal(fittingLog);

        let results = "";
        let log = "";

        log += `Image: ${frame.filename}\n`;
        log += this.getRegionInfoLog(regionId, fovInfo) + "\n";
        log += fittingLog + "\n";

        const toFixFormat = (param: string, value: number | string | null | undefined, error: number | null | undefined, unit: string | undefined, fixed: boolean): string => {
            const valueString = typeof value === "string" ? value : value?.toFixed(6);
            const errorString = fixed ? "" : " \u00b1 " + error?.toFixed(6);
            return `${param} = ${valueString}${errorString}${unit ? ` (${unit})` : ""}${fixed ? " (fixed)" : ""}\n`;
        };
        const toExpFormat = (param: string, value: number | string | null | undefined, error: number | null | undefined, unit: string | undefined, fixed: boolean): string => {
            const valueString = typeof value === "string" ? value : toExponential(value ?? NaN, 12);
            const errorString = fixed ? "" : " \u00b1 " + toExponential(error ?? NaN, 12);
            return `${param} = ${valueString}${errorString}${unit ? ` (${unit})` : ""}${fixed ? " (fixed)" : ""}\n`;
        };
        const formatTypeX = AppStore.Instance.overlaySettings.numbers?.formatTypeX;
        const formatTypeY = AppStore.Instance.overlaySettings.numbers?.formatTypeY;
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
                if (formatTypeX === NumberFormatType.Degrees && centerValueWCS) {
                    centerValueWCS.x += " (deg)";
                }
                if (formatTypeY === NumberFormatType.Degrees && centerValueWCS) {
                    centerValueWCS.y += " (deg)";
                }
                const centerErrorWCS = frame.getWcsSizeInArcsec(error.center as Point2D);
                if (formatTypeX === NumberFormatType.HMS) {
                    centerErrorWCS.x /= 15; // convert from arcsec to sec
                }
                if (formatTypeY === NumberFormatType.HMS) {
                    centerErrorWCS.y /= 15; // convert from arcsec to sec
                }
                const centerXUnit = centerFixedX ? "" : formatTypeX === NumberFormatType.HMS ? "s" : "arcsec";
                const centerYUnit = centerFixedY ? "" : formatTypeY === NumberFormatType.HMS ? "s" : "arcsec";

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

                results += toFixFormat("Center X       ", centerValueWCS?.x, centerErrorWCS?.x, centerXUnit, centerFixedX);
                results += toFixFormat("Center Y       ", centerValueWCS?.y, centerErrorWCS?.y, centerYUnit, centerFixedY);
                results += toFixFormat("Amplitude      ", value.amp, error.amp, frame.requiredUnit, amplitudeFixed);
                results += toFixFormat("FWHM Major Axis", fwhmValueWCS?.x, fwhmErrorWCS?.x, fwhmUnit, fwhmFixedX);
                results += toFixFormat("FWHM Minor Axis", fwhmValueWCS?.y, fwhmErrorWCS?.y, fwhmUnit, fwhmFixedY);
                results += toFixFormat("P.A.           ", value.pa, error.pa, "deg", paFixed);
                if (showIntegratedFlux) {
                    results += toFixFormat("Integrated flux", integratedFluxValues[i], integratedFluxErrors[i], "Jy", amplitudeFixed && fwhmFixedX && fwhmFixedY);
                }

                log += toExpFormat("Center X       ", centerValueWCS?.x, centerErrorWCS?.x, centerXUnit, centerFixedX);
                log += toExpFormat("               ", value.center?.x, error.center?.x, "px", centerFixedX);
                log += toExpFormat("Center Y       ", centerValueWCS?.y, centerErrorWCS?.y, centerYUnit, centerFixedY);
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

    /** Creates ellipse regions on the selected image based on the fitting results. */
    createRegions = async () => {
        const frame = this.effectiveFrame;
        const params = frame?.fittingResultRegionParams;
        if (!params) {
            return;
        }

        try {
            const newRegions = await Promise.all(
                params.map((param, index) => {
                    const name = `Fitting result: Component #${index + 1}`;
                    return frame.regionSet.addRegionAsync(CARTA.RegionType.ELLIPSE, param.points.slice(), param.rotation, name);
                })
            );
            newRegions?.forEach(r => r?.setDashLength(2));
            AppToaster.show(SuccessToast("tick", `Created ${params?.length} ellipse regions.`));
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
        const imageWidth = (AppStore.Instance.pixelRatio * baseFrame.renderWidth) / baseFrame.zoomLevel / baseFrame.aspectRatio;
        const imageHeight = (AppStore.Instance.pixelRatio * baseFrame.renderHeight) / baseFrame.zoomLevel;
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
                if (fovInfo && fovInfo.regionType !== null && fovInfo.regionType !== undefined && fovInfo.rotation !== null && fovInfo.rotation !== undefined) {
                    log += RegionStore.GetRegionProperties(fovInfo.regionType, fovInfo.controlPoints as Point2D[], fovInfo.rotation) + "\n";
                    log += this.effectiveFrame?.genRegionWcsProperties(fovInfo.regionType, fovInfo.controlPoints as Point2D[], fovInfo.rotation) + "\n";
                }
                break;
            default:
                const region = this.effectiveFrame?.getRegion(regionId);
                if (region) {
                    log += `Region: ${region.nameString}\n`;
                    log += region.regionProperties + "\n";
                    log += this.effectiveFrame?.getRegionWcsProperties(region) + "\n";
                }
                break;
        }
        return log;
    };

    private getRegionParams = (values: CARTA.IGaussianComponent[]): {points: Point2D[]; rotation: number}[] => {
        return values
            .map(value => {
                if (
                    !value.center ||
                    value.center.x === null ||
                    value.center.x === undefined ||
                    value.center.y === null ||
                    value.center.y === undefined ||
                    !value.fwhm ||
                    value.fwhm.x === null ||
                    value.fwhm.x === undefined ||
                    value.fwhm.y === null ||
                    value.fwhm.y === undefined
                ) {
                    return null;
                }

                const center = {x: value.center.x, y: value.center.y};
                // Half lengths of major and minor axes are used to defined an ellipse region. Divide FWHM of Gaussian by 2.
                const size = {x: value.fwhm.x / 2.0, y: value.fwhm.y / 2.0};
                return {points: [center, size], rotation: value?.pa};
            })
            .filter((params): params is {points: Point2D[]; rotation: number} => params !== null);
    };

    private setGeneratedInitVal = (log: string) => {
        const initValString = log.match(/Generated initial values([\s\S]*?)Gaussian fitting with/)?.[1];
        if (!initValString) {
            return;
        }

        const initVal = Array.from(initValString.matchAll(/=\s*([-\d.]+)\s*\(/g), match => Number(match[1]));
        if (initVal.length === 0 || initVal.length % 6 !== 0) {
            console.warn("Invalid initial values format in fitting log.");
            return;
        }

        const initVal2D = Array.from({length: Math.ceil(initVal.length / 6)}, (_, i) => initVal.slice(i * 6, i * 6 + 6));
        this.setComponents(initVal2D.length);
        for (let i = 0; i < initVal2D.length; i++) {
            const [centerX, centerY, amplitude, fwhmX, fwhmY, pa] = initVal2D[i];
            const component = this.components[i];
            component.setCenterX(centerX);
            component.setCenterY(centerY);
            component.setAmplitude(amplitude);
            component.setFwhmX(fwhmX);
            component.setFwhmY(fwhmY);
            component.setPa(pa);
        }
        this.setSelectedComponentIndex(0);
    };
}

class ImageFittingIndividualStore {
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

    @computed get centerWcs(): WCSPoint2D | null {
        // re-calculate with different wcs system
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const system = AppStore.Instance.overlaySettings.global.explicitSystem;
        const wcsInfo = AppStore.Instance.imageFittingStore?.effectiveFrame?.wcsInfoForTransformation;
        if (!wcsInfo || !isFinite(this.center.x) || !isFinite(this.center.y)) {
            return null;
        }
        return getFormattedWCSPoint(wcsInfo, this.center);
    }

    @computed get fwhmWcs(): WCSPoint2D | null {
        const frame = AppStore.Instance.imageFittingStore?.effectiveFrame;
        const wcsSize = frame?.getWcsSizeInArcsec(this.fwhm);
        if (!wcsSize) {
            return null;
        }
        const x = formattedArcsec(wcsSize.x, WCS_PRECISION);
        const y = formattedArcsec(wcsSize.y, WCS_PRECISION);
        if (x === null || y === null) {
            return null;
        }
        return {x, y};
    }

    @computed get validParams(): boolean {
        return isFinite(this.center.x) && isFinite(this.center.y) && isFinite(this.amplitude) && isFinite(this.fwhm.x) && isFinite(this.fwhm.y) && isFinite(this.pa);
    }

    @computed get fixedParams(): boolean[] {
        return [this.centerFixed.x, this.centerFixed.y, this.amplitudeFixed, this.fwhmFixed.x, this.fwhmFixed.y, this.paFixed];
    }

    @computed get fixedParamNum(): number {
        return this.fixedParams.filter(p => p === true).length;
    }

    @computed get allFixed(): boolean {
        return this.fixedParams.every(p => p === true);
    }

    setCenterXWcs = (val: string): boolean => {
        if (!isWCSStringFormatValid(val, AppStore.Instance.overlaySettings.numbers.formatTypeX)) {
            return false;
        }
        const wcsInfo = AppStore.Instance.imageFittingStore?.effectiveFrame?.wcsInfoForTransformation;
        if (!wcsInfo) {
            return false;
        }
        // initialize center Y with the wcs coordinate of the origin (0, 0) if center Y is not set yet
        // update center Y with the wcs coordinate of (0, center Y) if center Y is set and center X is not
        const centerYWcs = this.centerWcs?.y ?? getFormattedWCSPoint(wcsInfo, {x: 0, y: isFinite(this.center?.y) ? this.center?.y : 0})?.y;
        if (!centerYWcs) {
            return false;
        }
        const center = getPixelValueFromWCS(wcsInfo, {x: val, y: centerYWcs});
        if (!center) {
            return false;
        }
        return this.setCenter(center);
    };

    setCenterYWcs = (val: string): boolean => {
        if (!isWCSStringFormatValid(val, AppStore.Instance.overlaySettings.numbers.formatTypeY)) {
            return false;
        }
        const wcsInfo = AppStore.Instance.imageFittingStore?.effectiveFrame?.wcsInfoForTransformation;
        if (!wcsInfo) {
            return false;
        }
        // initialize center X with the wcs coordinate of origin (0, 0) if center X is not set yet
        // update center X with the wcs coordinate of (center X, 0) if center X is set and center Y is not
        const centerXWcs = this.centerWcs?.x ?? getFormattedWCSPoint(wcsInfo, {x: isFinite(this.center?.x) ? this.center?.x : 0, y: 0})?.x;
        if (!centerXWcs) {
            return false;
        }
        const center = getPixelValueFromWCS(wcsInfo, {x: centerXWcs, y: val});
        if (!center) {
            return false;
        }
        return this.setCenter(center);
    };

    setFwhmXWcs = (val: string): boolean => {
        const frame = AppStore.Instance.imageFittingStore?.effectiveFrame;
        const sizeInArcsec = getValueFromArcsecString(val);
        if (val && frame && sizeInArcsec !== null) {
            return this.setFwhmX(frame.getImageXValueFromArcsec(sizeInArcsec));
        }
        return false;
    };

    setFwhmYWcs = (val: string): boolean => {
        const frame = AppStore.Instance.imageFittingStore?.effectiveFrame;
        const sizeInArcsec = getValueFromArcsecString(val);
        if (val && frame && sizeInArcsec !== null) {
            return this.setFwhmY(frame.getImageYValueFromArcsec(sizeInArcsec));
        }
        return false;
    };
}
