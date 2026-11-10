import type {OptionProps} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {action, computed, type IReactionDisposer, makeObservable, observable, reaction} from "mobx";

import {PreferenceKeys, RegionId, RegionsType, type SpectralSystem, TelemetryAction} from "enums";
import {type ConfigurableStore, type Persisted, type WorkspaceConfigurableWidget, type WorkspaceIdReader, type WorkspaceIdWriter, type WorkspacePvGeneratorWidgetConfig} from "models";
import {TelemetryService} from "services";
import {AppStore, PreferenceStore} from "stores";
import {type FrameStore} from "stores/Frame";
import {length2D} from "utilities";

import {ACTIVE_FILE_ID, RegionWidgetStore} from "../RegionWidgetStore/RegionWidgetStore";

/** The settings that a PV generator widget saves in a layout. */
export interface PvGeneratorWidgetConfig {
    /** The own ID of the widget. It stays the same in every session that applies the layout. */
    widgetId: string;
}

/** The largest rebin factor that a restore reads. */
const MAX_WORKSPACE_REBIN = 1000;

function isPositiveInteger(value: unknown, max: number): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= max;
}

export class PvGeneratorWidgetStore extends RegionWidgetStore implements ConfigurableStore<PvGeneratorWidgetConfig, Persisted<PvGeneratorWidgetConfig>>, WorkspaceConfigurableWidget<WorkspacePvGeneratorWidgetConfig> {
    widgetId: string = "";
    @observable width: number = 3;
    @observable isReverse: boolean = PreferenceStore.Instance.isPVAxesOrderReverse;
    @observable shouldKeep: boolean = false;
    @observable range: CARTA.IntBounds.$Properties = {min: this.effectiveFrame?.channelValueBounds?.min, max: this.effectiveFrame?.channelValueBounds?.max};
    @observable xyRebin: number = 1;
    @observable zRebin: number = 1;
    @observable previewRegionId: number = RegionId.NONE;
    @observable previewFrame: FrameStore | null = null;
    @observable pvCutRegionId: number | null = null;
    @observable previewFullViewWidth: number = 1;
    @observable previewFullViewHeight: number = 1;

    private readonly disposers: IReactionDisposer[] = [];

    @computed get regionOptions(): OptionProps[] {
        const appStore = AppStore.Instance;
        let regionOptions: OptionProps[] = [{value: RegionId.NONE, label: "None"}];
        if (appStore.frames) {
            const selectedFrame = appStore.getFrame(this.fileId);
            if (selectedFrame?.regionSet) {
                const validRegionOptions = selectedFrame.regionSet.regions
                    ?.filter(r => !r.isTemporary && (r.regionType === CARTA.RegionType.LINE || r.regionType === CARTA.RegionType.POLYLINE))
                    ?.map(region => {
                        return {value: region?.regionId, label: region?.nameString};
                    });
                if (validRegionOptions) {
                    regionOptions = regionOptions.concat(validRegionOptions);
                }
            }
        }
        return regionOptions;
    }

    @computed get previewRegionOptions(): OptionProps[] {
        const appStore = AppStore.Instance;
        let previewRegionOptions: OptionProps[] = [{value: RegionId.IMAGE, label: "Image"}];
        if (appStore.frames) {
            const selectedFrame = appStore.getFrame(this.fileId);
            if (selectedFrame?.regionSet) {
                const validRegionOptions = selectedFrame.regionSet.regions
                    ?.filter(r => !r.isTemporary && r.regionType === CARTA.RegionType.RECTANGLE)
                    ?.map(region => {
                        return {value: region?.regionId, label: region?.nameString};
                    });
                if (validRegionOptions) {
                    previewRegionOptions = previewRegionOptions.concat(validRegionOptions);
                }
            }
        }
        return previewRegionOptions;
    }

    @computed get effectivePreviewRegionId(): number {
        if (this.effectiveFrame) {
            const regionId = this.previewRegionId;
            if (regionId !== RegionId.IMAGE && regionId !== undefined && this.effectiveFrame.getRegion(regionId)) {
                return regionId;
            }
        }
        return RegionId.IMAGE;
    }

    @action requestPV = (isPreview: boolean = false, pvGeneratorId?: string) => {
        const frame = this.effectiveFrame;
        if (!frame || frame.isSpectralAxisNonlinear) {
            return;
        }

        let channelIndexMin = frame.findChannelIndexByValue(this.range.min);
        let channelIndexMax = frame.findChannelIndexByValue(this.range.max);

        if (channelIndexMin === undefined || channelIndexMax === undefined) {
            return;
        }

        if (channelIndexMin > channelIndexMax) {
            const holder = channelIndexMax;
            channelIndexMax = channelIndexMin;
            channelIndexMin = holder;
        }
        if (channelIndexMin >= channelIndexMax) {
            if (channelIndexMax === 0) {
                channelIndexMax++;
            }
            channelIndexMin = channelIndexMax - 1;
        }
        if (frame && this.effectiveRegion) {
            const requestMessage: CARTA.PvRequest.$Properties = {
                fileId: frame.frameInfo.fileId,
                regionId: this.effectiveRegionId,
                width: this.width,
                spectralRange: isFinite(channelIndexMin) && isFinite(channelIndexMax) ? {min: channelIndexMin, max: channelIndexMax} : null,
                reverse: this.isReverse,
                keep: this.shouldKeep,
                previewSettings:
                    isPreview && pvGeneratorId
                        ? {
                              previewId: parseInt(pvGeneratorId.split("-")[2]),
                              regionId: this.effectivePreviewRegionId,
                              rebinXy: this.xyRebin,
                              rebinZ: this.zRebin,
                              imageCompressionQuality: PreferenceStore.Instance.imageCompressionQuality ?? 11,
                              animationCompressionQuality: PreferenceStore.Instance.animationCompressionQuality ?? 9,
                              compressionType: CARTA.CompressionType.ZFP
                          }
                        : undefined
            };
            if (isPreview && pvGeneratorId) {
                AppStore.Instance.requestPreviewPV(requestMessage, frame, pvGeneratorId);
            } else {
                AppStore.Instance.requestPV(requestMessage, frame, this.shouldKeep);
                const depth = channelIndexMax - channelIndexMin + 1;
                TelemetryService.Instance.addTelemetryEntry(TelemetryAction.PvGeneration, {regionId: this.effectiveRegion.regionId, regionType: this.effectiveRegion.regionType, length: length2D(this.effectiveRegion.size), depth});
            }
            frame.resetPvRequestState();
            frame.setIsRequestingPV(true);
        }
    };

    @action requestingPVCancelled = (pvGeneratorId: string) => {
        return () => {
            const frame = this.effectiveFrame;
            if (frame) {
                AppStore.Instance.cancelRequestingPV(frame.frameInfo.fileId, parseInt(pvGeneratorId.split("-")[2]));
                frame.setIsRequestPVCancelling(true);
            }
        };
    };

    @action setSpectralCoordinate = (coordStr: string) => {
        this.effectiveFrame?.setSpectralCoordinate(coordStr);
    };

    @action setSpectralSystem = (specsys: SpectralSystem) => {
        this.effectiveFrame?.setSpectralSystem(specsys);
    };

    @action setWidth = (val: number) => {
        this.width = val;
    };

    @action setReverse = (isReverse: boolean) => {
        this.isReverse = isReverse;
        PreferenceStore.Instance.setPreference(PreferenceKeys.SILENT_PV_AXES_ORDER_REVERSE, isReverse);
    };

    @action setKeep = (shouldKeep: boolean) => {
        this.shouldKeep = shouldKeep;
    };

    @action setSpectralRange = (range: CARTA.IntBounds.$Properties) => {
        if (isFinite(range.min ?? NaN) && isFinite(range.max ?? NaN)) {
            this.range = range;
        }
    };

    @action setXYRebin = (val: number) => {
        this.xyRebin = val;
    };

    @action setZRebin = (val: number) => {
        this.zRebin = val;
    };

    @action setPreviewRegionId = (regionId: number) => {
        this.previewRegionId = regionId;
    };

    @action setPreviewFrame = (frame: FrameStore | null) => {
        this.previewFrame = frame;
    };

    @action setPvCutRegionId = (regionId: number | null) => {
        this.pvCutRegionId = regionId;
    };

    @action removePreviewFrame = (id: number) => {
        AppStore.Instance.removePreviewFrame(id);
        this.previewFrame = null;
        this.pvCutRegionId = null;
    };

    @action onResizePreviewWidget = (width: number, height: number) => {
        if (width > 0 && height > 0) {
            this.previewFullViewWidth = width;
            this.previewFullViewHeight = height;
            this.previewFrame?.fitZoom();
        }
    };

    constructor() {
        super(RegionsType.LINE);
        makeObservable(this);

        this.regionIdMap.set(ACTIVE_FILE_ID, RegionId.NONE);

        this.disposers.push(
            reaction(
                () => this.effectiveFrame?.channelValueBounds,
                channelValueBounds => {
                    if (channelValueBounds) {
                        this.setSpectralRange(channelValueBounds);
                    }
                }
            )
        );
    }

    public applyConfig = (widgetSettings: Persisted<PvGeneratorWidgetConfig>): void => {
        if (typeof widgetSettings?.widgetId === "string" && widgetSettings.widgetId) {
            this.widgetId = widgetSettings.widgetId;
        }
    };

    public toConfig = (): PvGeneratorWidgetConfig => ({widgetId: this.widgetId});

    /** Returns the name of the spectral coordinate of the range, such as "Frequency (GHz), LSRK". A restore applies the range only in the same coordinate. */
    private get channelUnit(): string {
        const frame = this.effectiveFrame;
        return [frame?.spectralCoordinate, frame?.spectralSystem].filter(Boolean).join(", ");
    }

    /**
     * Returns the settings that a workspace saves. Leaves out a range of the whole spectral axis, so
     * that a restore in another spectral coordinate does not report a range that the user did not
     * choose.
     */
    public toWorkspaceConfig = (ids: WorkspaceIdWriter): WorkspacePvGeneratorWidgetConfig => {
        const bounds = this.effectiveFrame?.channelValueBounds;
        const {min, max} = this.range;
        const isWholeAxis = !bounds || (min === bounds.min && max === bounds.max);
        const hasRange = !isWholeAxis && typeof min === "number" && typeof max === "number";
        return {
            ...this.toWorkspaceBinding(ids),
            width: this.width,
            reverse: this.isReverse,
            keep: this.shouldKeep,
            xyRebin: this.xyRebin,
            zRebin: this.zRebin,
            ...(hasRange ? {channelRange: [min, max] as [number, number], channelUnit: this.channelUnit} : {}),
            previewRegionId: this.previewRegionId
        };
    };

    public applyWorkspaceBinding = (config: WorkspacePvGeneratorWidgetConfig, ids: WorkspaceIdReader): string[] => this.applyWorkspaceBindingOf(config, ids);

    /** Applies the saved settings. A value that is not valid keeps its default. The reverse setting does not change the preference. */
    @action public applyWorkspaceConfig = (config: WorkspacePvGeneratorWidgetConfig, ids: WorkspaceIdReader): string[] => {
        if (isPositiveInteger(config.width, Number.MAX_SAFE_INTEGER)) {
            this.setWidth(config.width);
        }
        if (typeof config.reverse === "boolean") {
            this.isReverse = config.reverse;
        }
        this.setKeep(config.keep === true);
        if (isPositiveInteger(config.xyRebin, MAX_WORKSPACE_REBIN)) {
            this.setXYRebin(config.xyRebin);
        }
        if (isPositiveInteger(config.zRebin, MAX_WORKSPACE_REBIN)) {
            this.setZRebin(config.zRebin);
        }
        const problems: string[] = [];
        if (typeof config.previewRegionId === "number" && config.previewRegionId !== RegionId.IMAGE && config.previewRegionId !== RegionId.NONE) {
            const imageId = config.imageId;
            const regionId = ids.regionIdOf(imageId, config.previewRegionId);
            if (regionId !== undefined) {
                this.setPreviewRegionId(regionId);
            } else {
                problems.push("the region that its preview showed was not restored, so the preview shows the whole image");
            }
        }
        return problems;
    };

    /**
     * Applies the saved spectral range. Apply it last. A change of the image or of its spectral
     * coordinate resets the range to the whole spectral axis.
     */
    @action public applyWorkspaceView = (config: WorkspacePvGeneratorWidgetConfig): void => {
        const range = config.channelRange;
        if (!this.isShowingWorkspaceData || !Array.isArray(range) || range.length !== 2 || !range.every(value => typeof value === "number" && isFinite(value))) {
            return;
        }
        if (config.channelUnit === this.channelUnit) {
            this.setSpectralRange({min: range[0], max: range[1]});
        }
    };

    public dispose = () => {
        this.disposers.forEach(disposer => disposer());
        this.disposers.length = 0;
    };
}
