import { action, observable, ObservableMap, makeObservable } from "mobx";
import {CARTA} from "carta-protobuf";
import {ProcessedSpectralProfile} from "models";

export class SpectralProfileStore {
    readonly regionId: number;
    readonly fileId: number;
    @observable stokes: number;
    @observable x: number;
    @observable y: number;
    @observable profiles: Map<string, ObservableMap<CARTA.StatsType, ProcessedSpectralProfile>>;

    constructor(fileId: number = 0, regionId: number = 0) {
        makeObservable(this);
        this.fileId = fileId;
        this.regionId = regionId;
        this.profiles = new Map<string, ObservableMap<CARTA.StatsType, ProcessedSpectralProfile>>();
    }

    getProfile(coordinate: string, statsType: CARTA.StatsType) {
        let coordinateMap = this.profiles.get(coordinate);
        if (coordinateMap) {
            return coordinateMap.get(statsType);
        }
        return null;
    }

    @action clearProfiles() {
        this.profiles = new Map<string, ObservableMap<CARTA.StatsType, ProcessedSpectralProfile>>();
    }

    @action setProfile(profile: ProcessedSpectralProfile) {
        let coordinateMap = this.profiles.get(profile.coordinate);
        if (!coordinateMap) {
            coordinateMap = new ObservableMap<CARTA.StatsType, ProcessedSpectralProfile>();
            this.profiles.set(profile.coordinate, coordinateMap);
        }
        coordinateMap.set(profile.statsType, profile);
    }
}