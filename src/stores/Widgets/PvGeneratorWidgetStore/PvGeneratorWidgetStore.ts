import type {OptionProps} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {action, computed, type IReactionDisposer, makeObservable, observable, reaction} from "mobx";

import {PreferenceKeys, RegionId, RegionsType, type SpectralSystem, TelemetryAction} from "enums";
import {
    type Persisted,
    type WorkspaceConfigurableWidget,
    type WorkspaceIdReader,
    type WorkspaceIdWriter,
    type WorkspaceLayoutConfigurable,
    type WorkspacePvGeneratorWidgetConfig,
    type WorkspacePvPreview,
    type WorkspacePvPreviewRequest
} from "models";
import {TelemetryService} from "services";
import {AppStore, PreferenceStore} from "stores";
import {type FrameStore} from "stores/Frame";
import {length2D, toFixed} from "utilities";

import {ACTIVE_FILE_ID, RegionWidgetStore} from "../RegionWidgetStore/RegionWidgetStore";

/** The settings of a PV request, by the IDs of this session. */
interface PvRequestSettings {
    fileId: number;
    regionId: number;
    width: number;
    /** The first and the last channel, or null for the whole spectral axis. */
    spectralRange: {min: number; max: number} | null;
    reverse: boolean;
    previewRegionId: number;
    xyRebin: number;
    zRebin: number;
}

/** The settings that a PV generator widget saves in the layout copy of a workspace. A regular layout saves no settings for it. */
export interface PvGeneratorWidgetConfig {
    /** The own ID of the widget. It stays the same in every session that restores the workspace. */
    widgetId: string;
}

/** The largest rebin factor that a restore reads. */
const MAX_WORKSPACE_REBIN = 1000;

function isPositiveInteger(value: unknown, max: number): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= max;
}

export class PvGeneratorWidgetStore extends RegionWidgetStore implements WorkspaceLayoutConfigurable<PvGeneratorWidgetConfig>, WorkspaceConfigurableWidget<WorkspacePvGeneratorWidgetConfig> {
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
    /**
     * The image that the spectral range was chosen on. A PV image has no spectral axis. When a new
     * PV image becomes the active image, the widget keeps the range of the image that the cut was
     * made on.
     */
    private rangeFrame: FrameStore | null = null;
    /** Whether the image that the saved spectral range was chosen on was not restored. The range is then not applied. */
    private isRangeImageMissing = false;

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

    /** Returns the size of the cube that a preview with the settings of the widget reads, in GB, or nothing when it cannot be estimated. */
    @computed get estimatedCubeSize(): number | undefined {
        const frame = this.effectiveFrame;
        if (!frame) {
            return undefined;
        }
        const channelIndexMin = frame.findChannelIndexByValue(this.range.min);
        const channelIndexMax = frame.findChannelIndexByValue(this.range.max);
        if (channelIndexMin === undefined || channelIndexMax === undefined) {
            return undefined;
        }
        return PvGeneratorWidgetStore.estimateCubeSize(frame, channelIndexMin, channelIndexMax, this.effectivePreviewRegionId, this.xyRebin, this.zRebin);
    }

    /** Returns the size of the cube that the shown preview read, in GB, or nothing when it cannot be estimated. */
    @computed get previewCubeSize(): number | undefined {
        const request = this.previewRequest;
        const frame = request ? AppStore.Instance.getFrame(request.fileId) : undefined;
        return request && frame
            ? PvGeneratorWidgetStore.estimateCubeSize(frame, request.spectralRange?.min ?? 0, request.spectralRange?.max ?? (frame.frameInfo.fileInfoExtended?.depth ?? 1) - 1, request.previewRegionId, request.xyRebin, request.zRebin)
            : undefined;
    }

    /** Returns the size of the cube that a preview of these settings reads, in GB, or nothing when it cannot be estimated. */
    private static estimateCubeSize(frame: FrameStore, channelIndexMin: number, channelIndexMax: number, previewRegionId: number, xyRebin: number, zRebin: number): number | undefined {
        if (!frame.frameInfo.fileInfoExtended) {
            return undefined;
        }

        // Find percentage of selected channel range
        const imageDepth = frame.frameInfo.fileInfoExtended.depth;
        const channelRangePercentage = Math.abs(channelIndexMax - channelIndexMin + 1) / imageDepth;

        // Find byte per image pixel
        const bitPixEntry = frame.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name?.match("BITPIX"));
        const bitPixValue = bitPixEntry?.numericValue;
        if (bitPixValue == null || !Number.isFinite(bitPixValue) || bitPixValue === 0) {
            return undefined;
        }
        const bytePix = Math.abs(bitPixValue) / 8;

        // Get rectangular region if exists
        const region = frame.getRegion(previewRegionId);
        const fileInfoExtended = frame.frameInfo.fileInfoExtended;

        // Get size of entire cube
        const imageSize = fileInfoExtended.width * fileInfoExtended.height * fileInfoExtended.depth * bytePix;

        // Get size of pixels bounded by the rectangular region
        const regionBoundSize = region?.regionId === -1 ? null : (region?.boundingBoxArea ?? 0) * bytePix * imageDepth;

        // Calculate estimated size using selected range of channels and rebin values
        const estimatedSize = ((regionBoundSize || imageSize) * channelRangePercentage) / (xyRebin * xyRebin * zRebin);

        if (region?.regionType !== CARTA.RegionType.RECTANGLE && !estimatedSize) {
            return undefined;
        }

        // Return estimated size in GB to be consistent with PreferenceStore.Instance.pvPreviewCubeSizeLimit
        return parseFloat(toFixed(estimatedSize / 1e9, 2));
    }

    @computed get isCubeSizeBelowLimit(): boolean {
        return (this.estimatedCubeSize ?? 0) <= PreferenceStore.Instance.pvPreviewCubeSizeLimit;
    }

    /** @returns the request of a preview, which ends when the preview is shown or the request fails. */
    @action requestPV = (isPreview: boolean = false, pvGeneratorId?: string): Promise<void> | undefined => {
        const frame = this.effectiveFrame;
        if (!frame || frame.isSpectralAxisNonlinear) {
            return undefined;
        }

        let channelIndexMin = frame.findChannelIndexByValue(this.range.min);
        let channelIndexMax = frame.findChannelIndexByValue(this.range.max);

        if (channelIndexMin === undefined || channelIndexMax === undefined) {
            return undefined;
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
            const settings: PvRequestSettings = {
                fileId: frame.frameInfo.fileId,
                regionId: this.effectiveRegionId ?? this.effectiveRegion.regionId,
                width: this.width,
                spectralRange: isFinite(channelIndexMin) && isFinite(channelIndexMax) ? {min: channelIndexMin, max: channelIndexMax} : null,
                reverse: this.isReverse,
                previewRegionId: this.effectivePreviewRegionId,
                xyRebin: this.xyRebin,
                zRebin: this.zRebin
            };
            return this.sendRequest(frame, settings, isPreview, pvGeneratorId, channelIndexMax - channelIndexMin + 1);
        }
        return undefined;
    };

    /** The settings of the last preview request. A workspace saves them with the preview. */
    @observable.ref private previewRequest: PvRequestSettings | undefined = undefined;
    /** The saved preview request by the IDs of this session, or why it cannot be made. A restore makes the preview with it. */
    private restoredPreviewRequest: PvRequestSettings | string | undefined = undefined;

    /** Returns the saved preview request by the IDs of this session, or why it cannot be made. */
    private static restoredRequestOf(saved: Persisted<WorkspacePvPreviewRequest> | undefined, ids: WorkspaceIdReader): PvRequestSettings | string | undefined {
        const isInteger = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);
        if (!saved || typeof saved !== "object" || !isInteger(saved.imageId) || !isInteger(saved.regionId) || !isInteger(saved.previewRegionId)) {
            return undefined;
        }
        const fileId = ids.fileIdOf(saved.imageId);
        const regionId = fileId === undefined ? undefined : ids.regionIdOf(saved.imageId, saved.regionId);
        if (fileId === undefined || regionId === undefined) {
            return "the image or the line region that the PV preview was made from was not restored, so the preview was not made again";
        }
        const isWholeImage = saved.previewRegionId === RegionId.IMAGE || saved.previewRegionId === RegionId.NONE;
        const previewRegionId = isWholeImage ? RegionId.IMAGE : ids.regionIdOf(saved.imageId, saved.previewRegionId);
        if (previewRegionId === undefined) {
            return "the region that the PV preview showed was not restored, so the preview was not made again";
        }
        const channels = saved.channels;
        const hasChannels = Array.isArray(channels) && channels.length === 2 && channels.every(channel => isInteger(channel) && channel >= 0) && channels[0] <= channels[1];
        return {
            fileId,
            regionId,
            width: isPositiveInteger(saved.width, Number.MAX_SAFE_INTEGER) ? saved.width : 3,
            spectralRange: hasChannels ? {min: channels[0], max: channels[1]} : null,
            reverse: saved.reverse === true,
            previewRegionId,
            xyRebin: isPositiveInteger(saved.xyRebin, MAX_WORKSPACE_REBIN) ? saved.xyRebin : 1,
            zRebin: isPositiveInteger(saved.zRebin, MAX_WORKSPACE_REBIN) ? saved.zRebin : 1
        };
    }

    /**
     * Asks the backend for a PV image or a preview with these settings.
     *
     * @param depth - the number of channels, for the telemetry of a PV image.
     * @returns the request of a preview, which ends when the preview is shown or the request fails.
     */
    @action private sendRequest(frame: FrameStore, settings: PvRequestSettings, isPreview: boolean, pvGeneratorId: string | undefined, depth: number): Promise<void> | undefined {
        {
            const requestMessage: CARTA.PvRequest.$Properties = {
                fileId: settings.fileId,
                regionId: settings.regionId,
                width: settings.width,
                spectralRange: settings.spectralRange,
                reverse: settings.reverse,
                keep: this.shouldKeep,
                previewSettings:
                    isPreview && pvGeneratorId
                        ? {
                              previewId: parseInt(pvGeneratorId.split("-")[2]),
                              regionId: settings.previewRegionId,
                              rebinXy: settings.xyRebin,
                              rebinZ: settings.zRebin,
                              imageCompressionQuality: PreferenceStore.Instance.imageCompressionQuality ?? 11,
                              animationCompressionQuality: PreferenceStore.Instance.animationCompressionQuality ?? 9,
                              compressionType: CARTA.CompressionType.ZFP
                          }
                        : undefined
            };
            let previewRequest: Promise<void> | undefined;
            if (isPreview && pvGeneratorId) {
                this.previewRequest = settings;
                // A flow is typed as the generator that it was written as, but it returns a promise.
                previewRequest = AppStore.Instance.requestPreviewPV(requestMessage, frame, pvGeneratorId) as unknown as Promise<void>;
            } else {
                AppStore.Instance.requestPV(requestMessage, frame, this.shouldKeep);
                const region = frame.getRegion(settings.regionId);
                if (region) {
                    TelemetryService.Instance.addTelemetryEntry(TelemetryAction.PvGeneration, {regionId: region.regionId, regionType: region.regionType, length: length2D(region.size), depth});
                }
            }
            frame.resetPvRequestState();
            frame.setIsRequestingPV(true);
            return previewRequest;
        }
    }

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
        this.previewRequest = undefined;
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
        this.rangeFrame = this.effectiveFrame?.channelValueBounds ? this.effectiveFrame : null;

        this.disposers.push(
            reaction(
                () => this.effectiveFrame?.channelValueBounds,
                channelValueBounds => {
                    if (channelValueBounds) {
                        this.rangeFrame = this.effectiveFrame ?? null;
                        this.setSpectralRange(channelValueBounds);
                    }
                }
            )
        );
    }

    public applyWorkspaceLayoutConfig = (widgetSettings: Persisted<PvGeneratorWidgetConfig>): void => {
        if (typeof widgetSettings?.widgetId === "string" && widgetSettings.widgetId) {
            this.widgetId = widgetSettings.widgetId;
        }
    };

    public toWorkspaceLayoutConfig = (): PvGeneratorWidgetConfig => ({widgetId: this.widgetId});

    /** Returns the image that the spectral range was chosen on, or nothing when that image was closed. */
    private get spectralFrame(): FrameStore | null | undefined {
        return this.rangeFrame && !this.rangeFrame.isDisposed ? this.rangeFrame : this.effectiveFrame;
    }

    /** Returns the name of the spectral coordinate of the range, such as "Frequency (GHz), LSRK". A restore applies the range only in the same coordinate. */
    private get channelUnit(): string {
        const frame = this.spectralFrame;
        return [frame?.spectralCoordinate, frame?.spectralSystem].filter(Boolean).join(", ");
    }

    /**
     * Returns the settings that a workspace saves. Leaves out a range of the whole spectral axis, so
     * that a restore in another spectral coordinate does not report a range that the user did not
     * choose. When the range was chosen on an image that is not the image of the widget, such as
     * the image of a PV cut while the PV image is active, saves that image with the range.
     */
    public toWorkspaceConfig = (ids: WorkspaceIdWriter): WorkspacePvGeneratorWidgetConfig => {
        const frame = this.spectralFrame;
        const bounds = frame?.channelValueBounds;
        const {min, max} = this.range;
        const isWholeAxis = !bounds || (min === bounds.min && max === bounds.max);
        const rangeImageId = frame && frame !== this.effectiveFrame ? ids.imageIdOf(frame.frameInfo.fileId) : undefined;
        const isRangeImageSaved = !frame || frame === this.effectiveFrame || rangeImageId !== undefined;
        const hasRange = !isWholeAxis && isRangeImageSaved && typeof min === "number" && typeof max === "number";
        return {
            ...this.toWorkspaceBinding(ids),
            width: this.width,
            reverse: this.isReverse,
            keep: this.shouldKeep,
            xyRebin: this.xyRebin,
            zRebin: this.zRebin,
            ...(hasRange ? {channelRange: [min, max] as [number, number], channelUnit: this.channelUnit} : {}),
            ...(hasRange && rangeImageId !== undefined ? {channelRangeImageId: rangeImageId} : {}),
            previewRegionId: this.previewRegionId,
            ...(this.previewFrame ? {preview: this.workspacePreviewOf(ids)} : {})
        };
    };

    /** Returns the key of the widget in the widgets store. The preview is made and shown by this key. */
    private get layoutId(): string | undefined {
        return [...AppStore.Instance.widgetsStore.pvGeneratorWidgets.entries()].find(([, widgetStore]) => widgetStore === this)?.[0];
    }

    /** Returns the floating PV Preview Viewer of the widget. The viewer is a floating widget of the type "pv-preview". */
    private get previewPanel() {
        const layoutId = this.layoutId;
        return layoutId === undefined ? undefined : AppStore.Instance.widgetsStore.floatingWidgets.find(config => config.type === "pv-preview" && config.parentId === layoutId);
    }

    /** Returns the preview that a workspace saves: the request that made it, how it is drawn and where its viewer is. */
    private workspacePreviewOf(ids: WorkspaceIdWriter): WorkspacePvPreview {
        const panel = this.previewPanel;
        const isPlaced = [panel?.defaultX, panel?.defaultY, panel?.defaultWidth, panel?.defaultHeight].every(value => typeof value === "number" && Number.isFinite(value));
        const request = this.previewRequest;
        const imageId = request ? ids.imageIdOf(request.fileId) : undefined;
        return {
            ...(request && imageId !== undefined
                ? {
                      request: {
                          imageId,
                          regionId: request.regionId,
                          width: request.width,
                          ...(request.spectralRange ? {channels: [request.spectralRange.min, request.spectralRange.max] as [number, number]} : {}),
                          reverse: request.reverse,
                          previewRegionId: request.previewRegionId,
                          xyRebin: request.xyRebin,
                          zRebin: request.zRebin
                      }
                  }
                : {}),
            ...(this.previewFrame ? {renderConfig: this.previewFrame.renderConfig.toConfig()} : {}),
            ...(this.previewFrame && AppStore.Instance.activeFrame === this.previewFrame ? {isActive: true} : {}),
            // The size of the preview that is shown, which the widget settings can differ from.
            ...(typeof (this.previewCubeSize ?? this.estimatedCubeSize) === "number" ? {cubeSize: this.previewCubeSize ?? this.estimatedCubeSize} : {}),
            ...(panel && isPlaced ? {panel: {x: panel.defaultX as number, y: panel.defaultY as number, width: panel.defaultWidth as number, height: panel.defaultHeight as number, ...PvGeneratorWidgetStore.widgetsBelowOf(panel)}} : {})
        };
    }

    /**
     * Returns how many other floating widgets are below the viewer panel. Settings panels are not
     * counted, because they save their own place in the stack. A floating widget is stacked by its
     * component ID when it has one, such as a catalog plot.
     */
    private static widgetsBelowOf(panel: (typeof AppStore.Instance.widgetsStore.floatingWidgets)[number]): {widgetsBelow?: number} {
        const {floatingWidgets} = AppStore.Instance.widgetsStore;
        const zIndexManager = AppStore.Instance.zIndexManager;
        const others = floatingWidgets.filter(config => config !== panel && !(config.type === "floating-settings" && config.parentId && config.parentType)).map(config => config.componentId || config.id);
        if (!zIndexManager || !others.length) {
            return {};
        }
        const index = zIndexManager.findIndex(panel.componentId || panel.id) ?? 0;
        return {widgetsBelow: others.filter(id => (zIndexManager.findIndex(id) ?? 0) < index).length};
    }

    /**
     * Asks the backend for the saved PV preview again, and draws it and places its viewer panel as
     * they were. A preview larger than the PV preview cube size limit of the preferences is not
     * made again. When the preview is not made again, closes a docked viewer that the layout copy
     * opened for it.
     *
     * @returns the problems, as sentences about the widget.
     */
    public restoreWorkspaceResult = async (config: WorkspacePvGeneratorWidgetConfig, isWanted: () => boolean = () => true): Promise<string[]> => {
        const problems = await this.remakeWorkspacePreview(config, isWanted);
        const layoutId = this.layoutId;
        if (isWanted() && !this.previewFrame && layoutId !== undefined) {
            AppStore.Instance.widgetsStore.closePvPreviewViewer(layoutId);
        }
        return problems;
    };

    private remakeWorkspacePreview = async (config: WorkspacePvGeneratorWidgetConfig, isWanted: () => boolean): Promise<string[]> => {
        const preview = config.preview;
        const layoutId = this.layoutId;
        const request = this.restoredPreviewRequest;
        this.restoredPreviewRequest = undefined;
        if (!preview || typeof preview !== "object" || layoutId === undefined) {
            return [];
        }
        if (typeof request === "string") {
            return [request];
        }
        // A preview saved without its request is made with the settings of the widget.
        const frame = request ? AppStore.Instance.getFrame(request.fileId) : this.effectiveFrame;
        const cubeSize =
            request && frame
                ? PvGeneratorWidgetStore.estimateCubeSize(frame, request.spectralRange?.min ?? 0, request.spectralRange?.max ?? (frame.frameInfo.fileInfoExtended?.depth ?? 1) - 1, request.previewRegionId, request.xyRebin, request.zRebin)
                : this.estimatedCubeSize;
        const limit = PreferenceStore.Instance.pvPreviewCubeSizeLimit;
        if ((cubeSize ?? 0) > limit) {
            return [`the PV preview needs about ${cubeSize} GB, more than the PV preview cube size limit of ${limit} GB, so it was not made again. Raise the limit in Preferences > Performance to make it`];
        }
        const cut = request ? frame?.getRegion(request.regionId) : this.effectiveRegion;
        if (!frame || cut?.regionType !== CARTA.RegionType.LINE) {
            return ["the line region of the PV preview was not restored, so the preview was not made again"];
        }
        if (request) {
            await this.sendRequest(frame, request, true, layoutId, 0);
        } else {
            await this.requestPV(true, layoutId);
        }
        // The preview came after the restore stopped waiting. It shows without the saved render settings and place.
        if (!isWanted()) {
            return [];
        }
        if (!this.previewFrame) {
            return ["could not make the PV preview again"];
        }
        if (preview.renderConfig && typeof preview.renderConfig === "object") {
            this.previewFrame.renderConfig.applyConfig(preview.renderConfig);
        }
        const panel = this.previewPanel;
        const saved = preview.panel;
        const isPlaced = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
        if (panel && saved && isPlaced(saved.x) && isPlaced(saved.y) && isPlaced(saved.width) && isPlaced(saved.height) && saved.width > 0 && saved.height > 0) {
            panel.setDefaultPosition(saved.x, saved.y);
            panel.setDefaultSize(saved.width, saved.height);
        }
        return [];
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
        this.restoredPreviewRequest = PvGeneratorWidgetStore.restoredRequestOf(config.preview?.request, ids);
        this.isRangeImageMissing = false;
        if (typeof config.channelRangeImageId === "number") {
            const fileId = ids.fileIdOf(config.channelRangeImageId);
            const frame = fileId !== undefined ? AppStore.Instance.getFrame(fileId) : undefined;
            if (frame) {
                this.rangeFrame = frame;
            } else {
                this.isRangeImageMissing = true;
                problems.push("the image that its spectral range was chosen on was not restored, so the range is the whole spectral axis");
            }
        }
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
     * coordinate resets the range to the whole spectral axis. The range is not applied when the
     * image that it was chosen on was not restored, because it would land on another image.
     */
    @action public applyWorkspaceView = (config: WorkspacePvGeneratorWidgetConfig): void => {
        const range = config.channelRange;
        if (this.isRangeImageMissing || !this.isShowingWorkspaceData || !Array.isArray(range) || range.length !== 2 || !range.every(value => typeof value === "number" && isFinite(value))) {
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
