import {action, observable, makeObservable} from "mobx";
import {CARTA} from "carta-protobuf";
import {ProcessedSpatialProfile, ProtobufProcessing} from "models";

export class SpatialProfileStore {
    readonly regionId: number;
    readonly fileId: number;
    @observable stokes: number;
    @observable channel: number;
    @observable x: number;
    @observable y: number;
    @observable profiles: Map<string, ProcessedSpatialProfile>;

    constructor(fileId: number = 0, regionId: number = 0) {
        makeObservable(this);
        this.fileId = fileId;
        this.regionId = regionId;
        this.profiles = new Map<string, ProcessedSpatialProfile>();
    }

    @action updateFromStream(spatialProfileData: CARTA.ISpatialProfileData) {
        // If the profile store has the same coordinates as the incoming one, just add to the profiles
        if (this.channel === spatialProfileData.channel && this.stokes === spatialProfileData.stokes && this.x === spatialProfileData.x && this.y === spatialProfileData.y) {
            for (let profile of spatialProfileData.profiles) {
                this.profiles.set(profile.coordinate, ProtobufProcessing.ProcessSpatialProfile(profile));
            }
        } else {
            // Otherwise create a new profile set
            this.channel = spatialProfileData.channel;
            this.stokes = spatialProfileData.stokes;
            this.x = spatialProfileData.x;
            this.y = spatialProfileData.y;
            const newProfilesMap = new Map<string, ProcessedSpatialProfile>();
            for (let profile of spatialProfileData.profiles) {
                newProfilesMap.set(profile.coordinate, ProtobufProcessing.ProcessSpatialProfile(profile));
            }
            this.profiles = newProfilesMap;
        }
    }

    @action setProfile(coordinate: string, profile: ProcessedSpatialProfile) {
        this.profiles.set(coordinate, profile);
    }

    @action setProfiles(profiles: Map<string, ProcessedSpatialProfile>) {
        this.profiles = profiles;
    }
}
