import {RegionWidgetStore, RegionsType} from "stores/widgets";
import {action, observable, makeObservable} from "mobx";

export class PVGeneratorWidgetStore extends RegionWidgetStore {
    @observable imageId: number;
    @observable regionId: number;
    @observable average: number;

    @action setImageId = (val: number) => {
        this.imageId = val;
    };

    // @action setRegionId = (val: number) => {
    //     this.regionId = val;
    // };

    @action setAverage = (val: number) => {
        this.average = val;
    };

    constructor() {
        super(RegionsType.CLOSED);
        makeObservable(this);
    }
}
