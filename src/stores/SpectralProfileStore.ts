import {action, observable, ObservableMap} from "mobx";
import {CARTA} from "carta-protobuf";

export class SpectralProfileStore {
    @observable regionId: number;
    @observable fileId: number;
    @observable stokes: number;
    @observable x: number;
    @observable y: number;
    @observable profiles: Map<string, ObservableMap<CARTA.StatsType, CARTA.ISpectralProfile>>;

    constructor(fileId: number = 0, regionId: number = 0) {
        this.fileId = fileId;
        this.regionId = regionId;
        this.profiles = new Map<string, ObservableMap<CARTA.StatsType, CARTA.ISpectralProfile>>();
    }

    getProfile(coordinate: string, statsType: CARTA.StatsType) {
        let coordinateMap = this.profiles.get(coordinate);
        if (coordinateMap) {
            return coordinateMap.get(statsType);
        }
        return null;
    }

    // Qi, return profile array accofing coordinate array
    getProfiles(coordinates: Array<string>, statsType: CARTA.StatsType): Array<CARTA.ISpectralProfile> {
        let profiles = [];
        coordinates.forEach(dataType => {
            let profile = this.getProfile(dataType, statsType);
            if (profile) {
                profiles.push(profile);
            }
        });
        return profiles;
    }

    @action clearProfiles() {
        this.profiles = new Map<string, ObservableMap<CARTA.StatsType, CARTA.ISpectralProfile>>();
    }

    @action setProfile(profile: CARTA.ISpectralProfile) {
        let coordinateMap = this.profiles.get(profile.coordinate);
        if (!coordinateMap) {
            coordinateMap = new ObservableMap<CARTA.StatsType, CARTA.ISpectralProfile>();
            this.profiles.set(profile.coordinate, coordinateMap);
        }
        coordinateMap.set(profile.statsType, profile);
    }
}