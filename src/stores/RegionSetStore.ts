import {action, observable} from "mobx";
import {FrameStore, RegionStore, RegionType} from "stores";
import {Point2D} from "models";

export enum RegionMode {
    MOVING,
    CREATING
}

export class RegionSetStore {
    private frame: FrameStore;
    @observable regions: RegionStore[];
    @observable selectedRegion: RegionStore;
    @observable mode: RegionMode;
    @observable newRegionType: RegionType;

    constructor(frame: FrameStore) {
        this.frame = frame;
        this.regions = [];
        this.selectedRegion = null;
        this.newRegionType = RegionType.RECTANGLE;
        this.mode = RegionMode.MOVING;
        this.addPointRegion({x: 0, y: 0});
    }

    private getNextRegionId = () => {
        let regionId = 0;
        if (this.regions.length) {
            let maxRegionId = Math.max(...this.regions.map(r => r.regionId));
            regionId = maxRegionId + 1;
        }
        return regionId;
    };

    @action addPointRegion = (center: Point2D) => {
        const region = new RegionStore(this.frame.frameInfo.fileId, [center], RegionType.POINT, this.getNextRegionId());
        this.regions.push(region);
        return region;
    };

    @action addRectangularRegion = (center: Point2D, width: number, height: number) => {
        const region = new RegionStore(this.frame.frameInfo.fileId, [center, {x: width, y: height}], RegionType.RECTANGLE, this.getNextRegionId());
        this.regions.push(region);
        return region;
    };

    @action addEllipticalRegion = (center: Point2D, semiMajor: number, semiMinor: number) => {
        const region = new RegionStore(this.frame.frameInfo.fileId, [center, {x: semiMajor, y: semiMinor}], RegionType.ELLIPSE, this.getNextRegionId());
        this.regions.push(region);
        return region;
    };

    @action selectRegion = (region: RegionStore) => {
        if (this.regions.indexOf(region) >= 0) {
            this.selectedRegion = region;
        }
    };

    @action deselectRegion = () => {
        this.selectedRegion = null;
    };

    @action deleteRegion = (region: RegionStore) => {
        if (region && this.regions.length) {
            if (region === this.selectedRegion) {
                this.selectedRegion = null;
            }
            this.regions = this.regions.filter(r => r !== region);
        }
    };

    @action setNewRegionType = (type: RegionType) => {
        this.newRegionType = type;
    };

    @action setMode = (mode) => {
        this.mode = mode;
    };

    @action toggleMode = () => {
        this.mode = (this.mode === RegionMode.MOVING) ? RegionMode.CREATING : RegionMode.MOVING;
    };
}