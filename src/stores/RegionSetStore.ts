import {action, observable} from "mobx";
import {FrameStore, RegionStore, RegionType} from "stores";
import {Point2D} from "models";

export class RegionSetStore {
    private frame: FrameStore;
    @observable regions: RegionStore[];

    constructor(frame: FrameStore) {
        this.frame = frame;
        this.regions = [];
    }

    @action addRectangularRegion = (lb: Point2D, rt: Point2D) => {
        const region = new RegionStore(this.frame.frameInfo.fileId, [lb, rt], RegionType.RECTANGLE);
        this.regions.push(region);
    };
}