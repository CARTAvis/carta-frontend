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

    @action addRectangularRegion = (center: Point2D, width: number, height: number) => {
        const region = new RegionStore(this.frame.frameInfo.fileId, [center, {x: width, y: height}], RegionType.RECTANGLE);
        this.regions.push(region);
    };
}