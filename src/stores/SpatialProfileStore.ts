import {action, observable} from "mobx";
import {ProcessedSpatialProfile} from "models";

export class SpatialProfileStore {
    @observable regionId: number;
    @observable fileId: number;
    @observable stokes: number;
    @observable channel: number;
    @observable x: number;
    @observable y: number;
    @observable profiles: Map<string, ProcessedSpatialProfile>;

    constructor(fileId: number = 0, regionId: number = 0) {
        this.fileId = fileId;
        this.regionId = regionId;
        this.profiles = new Map<string, ProcessedSpatialProfile>();
    }

    @action setProfile(coordinate: string, profile: ProcessedSpatialProfile) {
        this.profiles.set(coordinate, profile);
    }

    @action setProfiles(profiles: Map<string, ProcessedSpatialProfile>) {
        this.profiles = profiles;
    }
}