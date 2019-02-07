import {action, observable} from "mobx";
import {FrameStore, RegionStore, RegionType} from "stores";
import {Point2D} from "models";

export class RegionSetStore {
    private frame: FrameStore;
    @observable regions: RegionStore[];
    @observable selectedRegion: RegionStore;

    constructor(frame: FrameStore) {
        this.frame = frame;
        this.regions = [];
        this.selectedRegion = null;
    }

    @action addRectangularRegion = (center: Point2D, width: number, height: number) => {
        let regionId = 0;
        if (this.regions.length) {
            let maxRegionId = Math.max(...this.regions.map(r => r.regionId));
            regionId = maxRegionId + 1;
        }
        const region = new RegionStore(this.frame.frameInfo.fileId, [center, {x: width, y: height}], RegionType.RECTANGLE, regionId);
        this.regions.push(region);
    };

    @action selectRegion = (region: RegionStore) => {
        if (this.regions.indexOf(region) >= 0) {
            this.selectedRegion = region;
        }
    };

    @action deselectRegion = () => {
        this.selectedRegion = null;
    };
}