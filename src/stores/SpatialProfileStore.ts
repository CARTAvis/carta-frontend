import {observable} from "mobx";

export class SpatialProfileData {
    start: number;
    end: number;
    values: Float32Array;
    coordinate: string;
}

export class SpatialProfileStore {
    @observable regionId: number;
    @observable fileId: number;
    @observable stokes: number;
    @observable channel: number;
    @observable x: number;
    @observable y: number;
    @observable profiles: SpatialProfileData[];
}