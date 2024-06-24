import {CARTA} from "carta-protobuf";
import {action, makeObservable, observable, ObservableMap} from "mobx";

import {ProcessedSpectralProfile} from "utilities";

type Coordinate = string;

export class SpectralProfileStore {
    readonly fileId: number;
    readonly regionId: number;
    @observable profiles: Map<Coordinate, ObservableMap<CARTA.StatsType, ProcessedSpectralProfile>>;

    constructor(fileId: number = 0, regionId: number = 0) {
        makeObservable(this);
        this.fileId = fileId;
        this.regionId = regionId;
        this.profiles = new Map<Coordinate, ObservableMap<CARTA.StatsType, ProcessedSpectralProfile>>();
    }

    public getProfile = (coordinate: Coordinate, statsType: CARTA.StatsType): ProcessedSpectralProfile | null | undefined => {
        let coordinateMap = this.profiles.get(coordinate);
        if (coordinateMap) {
            return coordinateMap.get(statsType);
        }
        return null;
    };

    @action resetProfilesProgress = () => {
        this.profiles.forEach(statsProfilesMap => {
            statsProfilesMap?.forEach(processedSpectralProfile => {
                if (processedSpectralProfile) {
                    processedSpectralProfile.progress = 0;
                }
            });
        });
    };

    @action setProfile = (profile: ProcessedSpectralProfile) => {
        let coordinateMap = this.profiles.get(profile.coordinate ?? "");
        if (!coordinateMap) {
            coordinateMap = new ObservableMap<CARTA.StatsType, ProcessedSpectralProfile>();
            if (profile.coordinate) {
                this.profiles.set(profile.coordinate, coordinateMap);
            }
        }
        if (profile.statsType !== undefined && profile.statsType !== null) {
            coordinateMap.set(profile.statsType, profile);
        }
    };
}
