import {CARTA} from "carta-protobuf";
import {action, computed, makeObservable, observable} from "mobx";

import {Polarizations, RegionsType} from "enums";
import {type ConfigurableStore, type Persisted, VALID_COORDINATES, type WorkspaceConfigurableWidget, type WorkspaceIdReader, type WorkspaceIdWriter, type WorkspaceStatsWidgetConfig} from "models";
import {AppStore} from "stores";
import {RegionWidgetStore} from "stores/Widgets";

/** What a statistics widget saves. */
export interface StatsWidgetConfig {
    /** The widget's own ID, which stays the same across the sessions a layout is applied in. */
    widgetId: string;
}

export class StatsWidgetStore extends RegionWidgetStore implements ConfigurableStore<StatsWidgetConfig, Persisted<StatsWidgetConfig>>, WorkspaceConfigurableWidget<WorkspaceStatsWidgetConfig> {
    widgetId: string = "";
    @observable coordinate: string = "z";

    public toWorkspaceConfig = (ids: WorkspaceIdWriter): WorkspaceStatsWidgetConfig => ({...this.toWorkspaceBinding(ids), coordinate: this.coordinate});

    public applyWorkspaceBinding = (config: WorkspaceStatsWidgetConfig, ids: WorkspaceIdReader): string[] => this.applyWorkspaceBindingOf(config, ids);

    public applyWorkspaceConfig = (config: WorkspaceStatsWidgetConfig): string[] => {
        if (config.coordinate === undefined || config.coordinate === this.coordinate) {
            return [];
        }
        if (!VALID_COORDINATES.includes(config.coordinate)) {
            return [`it cannot be taken in the Stokes ${config.coordinate}`];
        }
        this.setCoordinate(config.coordinate);
        return [];
    };

    @action setCoordinate = (coordinate: string) => {
        // Check coordinate validity
        if (VALID_COORDINATES.indexOf(coordinate) !== -1) {
            this.coordinate = coordinate;
        }
    };

    @computed get effectivePolarization(): Polarizations | undefined {
        if (this.coordinate === "z") {
            return this.effectiveFrame?.requiredPolarization;
        } else {
            return Polarizations[this.coordinate.substring(0, this.coordinate.length - 1)];
        }
    }

    constructor() {
        super(RegionsType.CLOSED);
        makeObservable(this);
    }

    public applyConfig = (widgetSettings: Persisted<StatsWidgetConfig>): void => {
        if (typeof widgetSettings?.widgetId === "string" && widgetSettings.widgetId) {
            this.widgetId = widgetSettings.widgetId;
        }
    };

    public toConfig = (): StatsWidgetConfig => ({widgetId: this.widgetId});

    public static calculateRequirementsMap(widgetsMap: Map<string, StatsWidgetStore>) {
        const updatedRequirements = new Map<number, Map<number, CARTA.SetStatsRequirements>>();

        widgetsMap.forEach(widgetStore => {
            const frame = widgetStore.effectiveFrame;
            if (!frame || !frame.regionSet) {
                return;
            }
            const fileId = frame.frameInfo.fileId;
            const regionId = widgetStore.effectiveRegionId;
            const coordinate = widgetStore.coordinate;
            const region = frame.regionSet.regions.find(r => r.regionId === regionId);
            if (regionId === -1 || (region && region.isClosedRegion)) {
                let frameRequirements = updatedRequirements.get(fileId);
                if (!frameRequirements) {
                    frameRequirements = new Map<number, CARTA.SetStatsRequirements>();
                    updatedRequirements.set(fileId, frameRequirements);
                }

                let regionRequirements = frameRequirements.get(regionId ?? NaN);
                if (!regionRequirements && regionId !== null) {
                    regionRequirements = new CARTA.SetStatsRequirements({fileId, regionId});
                    frameRequirements.set(regionId, regionRequirements);
                }

                if (regionRequirements && !regionRequirements.statsConfigs) {
                    regionRequirements.statsConfigs = [];
                }

                const histogramConfig = regionRequirements?.statsConfigs.find(config => config.coordinate === coordinate);
                if (!histogramConfig) {
                    regionRequirements?.statsConfigs.push({coordinate: coordinate, statsTypes: AppStore.DEFAULT_STATS_TYPES});
                }
            }
        });
        return updatedRequirements;
    }

    // This function diffs the updated requirements map with the existing requirements map, and reacts to changes
    // Three diff cases are checked:
    // 1. The old map has an entry, but the new one does not => send an "empty" SetStatsRequirements message
    // 2. The old and new maps both have entries, but they are different => send the new SetStatsRequirements message
    // 3. The new map has an entry, but the old one does not => send the new SetStatsRequirements message
    // The easiest way to check all three is to first add any missing entries to the new map (as empty requirements), and then check the updated maps entries
    public static diffStatsRequirements(originalRequirements: Map<number, Map<number, CARTA.SetStatsRequirements>>, updatedRequirements: Map<number, Map<number, CARTA.SetStatsRequirements>>) {
        const diffList: CARTA.SetStatsRequirements[] = [];

        // Fill updated requirements with missing entries
        originalRequirements.forEach((frameRequirements, fileId) => {
            let updatedFrameRequirements = updatedRequirements.get(fileId);
            if (!updatedFrameRequirements) {
                updatedFrameRequirements = new Map<number, CARTA.SetStatsRequirements>();
                updatedRequirements.set(fileId, updatedFrameRequirements);
            }
            frameRequirements.forEach((regionRequirements, regionId) => {
                let updatedRegionRequirements = updatedFrameRequirements?.get(regionId);
                if (!updatedRegionRequirements) {
                    updatedRegionRequirements = new CARTA.SetStatsRequirements({fileId, regionId, statsConfigs: []});
                    updatedFrameRequirements?.set(regionId, updatedRegionRequirements);
                }
            });
        });

        // Go through updated requirements entries and find differences
        updatedRequirements.forEach((updatedFrameRequirements, fileId) => {
            const frameRequirements = originalRequirements.get(fileId);
            if (!frameRequirements) {
                // If there are no existing requirements for this fileId, all entries for this file are new
                updatedFrameRequirements.forEach(regionRequirements => diffList.push(regionRequirements));
            } else {
                updatedFrameRequirements.forEach((updatedRegionRequirements, regionId) => {
                    const regionRequirements = frameRequirements?.get(regionId);
                    if (!regionRequirements) {
                        // If there are no existing requirements for this regionId, this is a new entry
                        diffList.push(updatedRegionRequirements);
                    } else {
                        // Deep equality comparison with sorted arrays
                        const configCount = regionRequirements.statsConfigs ? regionRequirements.statsConfigs.length : 0;
                        const updatedConfigCount = updatedRegionRequirements.statsConfigs ? updatedRegionRequirements.statsConfigs.length : 0;

                        if (configCount !== updatedConfigCount) {
                            diffList.push(updatedRegionRequirements);
                            return;
                        }

                        if (configCount === 0) {
                            return;
                        }
                        const sortedUpdatedConfigs = updatedRegionRequirements.statsConfigs.sort((a, b) => ((a.coordinate ?? NaN) > (b.coordinate ?? NaN) ? 1 : -1));
                        const sortedConfigs = regionRequirements.statsConfigs.sort((a, b) => ((a.coordinate ?? NaN) > (b.coordinate ?? NaN) ? 1 : -1));

                        for (let i = 0; i < updatedConfigCount; i++) {
                            const updatedConfig = sortedUpdatedConfigs[i];
                            const config = sortedConfigs[i];
                            if (updatedConfig.coordinate !== config.coordinate) {
                                diffList.push(updatedRegionRequirements);
                                return;
                            }
                        }
                    }
                });
            }
        });
        // Sort list so that requirements clearing occurs first
        return diffList.sort((a, b) => (a.statsConfigs.length > b.statsConfigs.length ? 1 : -1));
    }
}
