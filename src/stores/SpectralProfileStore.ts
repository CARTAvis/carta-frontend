import {action, observable} from "mobx";
import {CARTA} from "carta-protobuf";

export class SpectralProfileStore {
    @observable regionId: number;
    @observable fileId: number;
    @observable stokes: number;
    @observable x: number;
    @observable y: number;
    @observable channelValues: number[];
    @observable profiles: Map<string, CARTA.SpectralProfile>;

    constructor(fileId: number = 0, regionId: number = 0) {
        this.fileId = fileId;
        this.regionId = regionId;
        this.profiles = new Map<string, CARTA.SpectralProfile>();
    }

    @action setChannelValues(values: number[]) {
        this.channelValues = values;
    }

    @action setProfile(coordinate: string, profile: CARTA.SpectralProfile) {
        this.profiles.set(coordinate, profile);
    }

    @action setProfiles(profiles: Map<string, CARTA.SpectralProfile>) {
        this.profiles = profiles;
    }
}