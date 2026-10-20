import type {OptionProps} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {action, computed, makeObservable, observable} from "mobx";

import {RegionId, RegionsType} from "enums";
import {type WorkspaceIdReader, type WorkspaceIdWriter, type WorkspaceWidgetBinding} from "models";
import {AppStore} from "stores";
import {type FrameStore, type RegionStore} from "stores/Frame";

export const ACTIVE_FILE_ID = -1;

export class RegionWidgetStore {
    protected readonly appStore: AppStore;
    @observable fileId: number = ACTIVE_FILE_ID;
    @observable regionIdMap: Map<number, number> = new Map<number, number>();
    @observable type: RegionsType;

    constructor(type: RegionsType) {
        this.appStore = AppStore.Instance;
        this.type = type;
        makeObservable(this);
    }

    @action clearFrameEntry = (fileId: number) => {
        this.regionIdMap.delete(fileId);
    };

    @action clearRegionMap = () => {
        this.regionIdMap.clear();
    };

    @action setRegionId(fileId: number, regionId: number) {
        this.regionIdMap.set(fileId, regionId);
    }

    @action setFileId = (fileId: number) => {
        this.fileId = fileId;
    };

    /**
     * Which image and region the widget shows, as a workspace names them. An image the workspace
     * does not carry is left out, and the widget comes back showing the active one (ADR-0006).
     */
    protected toWorkspaceBinding(ids: WorkspaceIdWriter): WorkspaceWidgetBinding {
        const imageIdOf = (fileId: number): number | undefined | null => (fileId === ACTIVE_FILE_ID ? undefined : (ids.imageIdOf(fileId) ?? null));
        const imageId = imageIdOf(this.fileId);
        const regions = Array.from(this.regionIdMap.entries()).flatMap(([fileId, regionId]) => {
            const regionImageId = imageIdOf(fileId);
            return regionImageId === null ? [] : [regionImageId === undefined ? {regionId} : {imageId: regionImageId, regionId}];
        });
        return {...(typeof imageId === "number" ? {imageId} : {}), ...(regions.length ? {regions} : {})};
    }

    /**
     * Point the widget at the image and region a workspace says it showed, falling back to the
     * active ones for those that were not restored.
     *
     * @returns what could not be pointed at.
     */
    @action protected applyWorkspaceBindingOf(binding: WorkspaceWidgetBinding, ids: WorkspaceIdReader): string[] {
        const problems: string[] = [];
        let fileId = ACTIVE_FILE_ID;
        if (binding.imageId !== undefined) {
            const restoredFileId = ids.fileIdOf(binding.imageId);
            if (restoredFileId === undefined) {
                problems.push("the image it showed was not restored, so it shows the active image");
            } else {
                fileId = restoredFileId;
            }
        }
        this.setFileId(fileId);

        this.clearRegionMap();
        for (const saved of binding.regions ?? []) {
            const regionFileId = saved.imageId === undefined ? ACTIVE_FILE_ID : ids.fileIdOf(saved.imageId);
            if (regionFileId === undefined) {
                continue;
            }
            const regionId = ids.regionIdOf(saved.imageId, saved.regionId);
            if (regionId !== undefined) {
                this.setRegionId(regionFileId, regionId);
            } else if (regionFileId === fileId) {
                problems.push("the region it showed was not restored, so it shows the active region");
            }
        }
        return problems;
    }

    @computed get effectiveFrame(): FrameStore | null | undefined {
        if (this.appStore.activeFrame && this.appStore.frames?.length > 0) {
            return this.fileId === ACTIVE_FILE_ID || !this.appStore.getFrame(this.fileId) ? this.appStore.activeFrame : this.appStore.getFrame(this.fileId);
        }
        return null;
    }

    @computed get isEffectiveFrameEqualToActiveFrame(): boolean {
        if (!this.effectiveFrame) {
            return false;
        }
        return this.appStore.activeFrame?.frameInfo.fileId === this.effectiveFrame.frameInfo.fileId;
    }

    @computed get effectiveRegionId(): number | null {
        if (this.effectiveFrame) {
            const regionId = this.regionIdMap.get(this.fileId);
            if (regionId !== RegionId.ACTIVE && regionId !== RegionId.NONE && regionId !== undefined) {
                return regionId;
            } else if (regionId === RegionId.NONE) {
                return null;
            } else {
                const selectedRegion = this.effectiveFrame.regionSet?.focusedRegion;
                if (selectedRegion) {
                    switch (this.type) {
                        case RegionsType.CLOSED:
                            return selectedRegion.isClosedRegion ? selectedRegion.regionId : this.defaultRegionId();
                        case RegionsType.CLOSED_AND_POINT:
                        case RegionsType.POINT_AND_LINES:
                            return selectedRegion.regionId;
                        case RegionsType.LINE:
                        default:
                            return selectedRegion.regionType === CARTA.RegionType.LINE ? selectedRegion.regionId : this.defaultRegionId();
                    }
                }
            }
        }

        return this.defaultRegionId();
    }

    private defaultRegionId(): number | null {
        switch (this.type) {
            case RegionsType.CLOSED:
                return RegionId.IMAGE;
            case RegionsType.CLOSED_AND_POINT:
            case RegionsType.POINT_AND_LINES:
                return RegionId.CURSOR;
            case RegionsType.LINE:
            default:
                return null;
        }
    }

    @computed get effectiveRegion(): RegionStore | undefined {
        return this.effectiveFrame?.getRegion(this.effectiveRegionId ?? NaN);
    }

    @computed get effectiveRegionInfo(): string | undefined {
        if (this.effectiveFrame) {
            if (this.effectiveRegionId === RegionId.IMAGE) {
                return "Image";
            } else {
                return this.effectiveRegion?.nameString ?? undefined;
            }
        }
        return undefined;
    }

    @computed get isMatchingSelectedRegion(): boolean {
        if (this.isEffectiveFrameEqualToActiveFrame) {
            const focusedRegion = this.appStore.focusedRegion;
            if (this.effectiveRegionId === focusedRegion?.regionId) {
                return true;
            }
            if (focusedRegion?.regionId === RegionId.CURSOR && this.effectiveRegionId === RegionId.IMAGE) {
                return true;
            }
        }
        return false;
    }

    @computed get frameOptions(): OptionProps[] {
        return [{value: ACTIVE_FILE_ID, label: "Active"}, ...(AppStore.Instance.frameNames ?? [])];
    }

    public static calculateRequirementsArray(widgetsMap: Map<string, RegionWidgetStore>) {
        const updatedRequirements = new Map<number, Array<number>>();

        widgetsMap.forEach(widgetStore => {
            const frame = widgetStore.effectiveFrame;
            if (!frame) {
                return;
            }
            const fileId = frame.frameInfo.fileId;
            const regionId = widgetStore.effectiveRegionId;
            const region = frame.getRegion(regionId ?? NaN);
            if (regionId === -1 || region?.isClosedRegion) {
                let frameRequirementsArray = updatedRequirements.get(fileId);
                if (!frameRequirementsArray) {
                    frameRequirementsArray = [];
                    updatedRequirements.set(fileId, frameRequirementsArray);
                }
                if (!frameRequirementsArray.includes(regionId ?? NaN)) {
                    frameRequirementsArray.push(regionId ?? NaN);
                }
            }
        });
        return updatedRequirements;
    }
}
