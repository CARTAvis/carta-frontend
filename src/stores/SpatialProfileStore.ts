import {action, observable, makeObservable} from "mobx";
import {CARTA} from "carta-protobuf";
import {ProcessedSpatialProfile, ProtobufProcessing} from "models";

type Coordinate = string; // combination of I/Q/U/V stokes & x/y spatial axis, e.g. "Ix", "Qy"

export class SpatialProfileStore {
    readonly regionId: number;
    readonly fileId: number;
    @observable channel: number;
    @observable value: number;
    @observable x: number;
    @observable y: number;
    @observable profiles: Map<Coordinate, ProcessedSpatialProfile>;

    constructor(fileId: number = 0, regionId: number = 0) {
        makeObservable(this);
        this.fileId = fileId;
        this.regionId = regionId;
        this.profiles = new Map<Coordinate, ProcessedSpatialProfile>();
    }

    public getProfile = (coordinate: Coordinate): ProcessedSpatialProfile => {
        return this.profiles?.get(coordinate);
    };

    @action updateFromStream(spatialProfileData: CARTA.ISpatialProfileData) {
        if (spatialProfileData) {
            this.channel = spatialProfileData.channel;
            this.value = spatialProfileData.value;
            this.x = spatialProfileData.x;
            this.y = spatialProfileData.y;
            spatialProfileData.profiles?.forEach(profile => this.profiles.set(profile.coordinate, ProtobufProcessing.ProcessSpatialProfile(profile)));
        }
    }

    @action setProfile(coordinate: Coordinate, profile: ProcessedSpatialProfile) {
        this.profiles.set(coordinate, profile);
    }

    @action setProfiles(profiles: Map<Coordinate, ProcessedSpatialProfile>) {
        this.profiles = profiles;
    }
}
