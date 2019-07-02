import {action, observable} from "mobx";
import {CARTA} from "carta-protobuf";
import {FrameStore, RegionStore} from "stores";
import {Point2D} from "models";
import {BackendService} from "../services";

export enum RegionMode {
    MOVING,
    CREATING
}

export class RegionSetStore {
    @observable regions: RegionStore[];
    @observable selectedRegion: RegionStore;
    @observable mode: RegionMode;
    @observable newRegionType: CARTA.RegionType;

    private frame: FrameStore;
    private readonly backendService: BackendService;
    private readonly regionPreference: RegionStore;

    constructor(frame: FrameStore, regionPreference: RegionStore, backendService: BackendService) {
        this.frame = frame;
        this.backendService = backendService;
        this.regionPreference = regionPreference;
        this.regions = [];
        this.newRegionType = regionPreference.regionType;
        this.mode = RegionMode.MOVING;
        this.addPointRegion({x: 0, y: 0}, true);
        this.selectedRegion = this.regions[0];
    }

    // temporary region IDs are < 0 and used
    private getTempRegionId = () => {
        let regionId = -1;
        if (this.regions.length) {
            let minRegionId = Math.min(...this.regions.map(r => r.regionId));
            regionId = Math.min(regionId, minRegionId - 1);
        }
        return regionId;
    };

    @action addPointRegion = (center: Point2D, cursorRegion = false) => {
        let regionId;
        if (cursorRegion) {
            regionId = 0;
        } else {
            regionId = this.getTempRegionId();
        }

        const region = new RegionStore(this.backendService, this.frame.frameInfo.fileId, [center], CARTA.RegionType.POINT, regionId);
        this.regions.push(region);
        console.log(region);
        if (!cursorRegion) {
            this.backendService.setRegion(this.frame.frameInfo.fileId, -1, region).subscribe(ack => {
                if (ack.success) {
                    region.setRegionId(ack.regionId);
                }
            });
        }
        return region;
    };

    @action addRectangularRegion = (center: Point2D, width: number, height: number, temporary: boolean = false) => {
        const region = new RegionStore(this.backendService, this.frame.frameInfo.fileId, [center, {x: width, y: height}], CARTA.RegionType.RECTANGLE, this.getTempRegionId(),
                                        this.regionPreference.color, this.regionPreference.lineWidth, this.regionPreference.dashLength);
        this.regions.push(region);
        if (!temporary) {
            this.backendService.setRegion(this.frame.frameInfo.fileId, -1, region).subscribe(ack => {
                if (ack.success) {
                    console.log(`Updating regionID from ${region.regionId} to ${ack.regionId}`);
                    region.setRegionId(ack.regionId);
                }
            });
        }
        return region;
    };

    @action addEllipticalRegion = (center: Point2D, semiMajor: number, semiMinor: number, temporary: boolean = false) => {
        const region = new RegionStore(this.backendService, this.frame.frameInfo.fileId, [center, {x: semiMinor, y: semiMajor}], CARTA.RegionType.ELLIPSE, this.getTempRegionId(),
                                        this.regionPreference.color, this.regionPreference.lineWidth, this.regionPreference.dashLength);
        this.regions.push(region);
        if (!temporary) {
            this.backendService.setRegion(this.frame.frameInfo.fileId, -1, region).subscribe(ack => {
                if (ack.success) {
                    console.log(`Updating regionID from ${region.regionId} to ${ack.regionId}`);
                    region.setRegionId(ack.regionId);
                }
            });
        }
        return region;
    };

    @action selectRegion = (region: RegionStore) => {
        if (this.regions.indexOf(region) >= 0) {
            this.selectedRegion = region;
        }
    };

    @action selectRegionByIndex = (index: number) => {
        if (index >= 0 && index < this.regions.length) {
            this.selectedRegion = this.regions[index];
        }
    };

    @action deselectRegion = () => {
        this.selectedRegion = null;
    };

    @action deleteRegion = (region: RegionStore) => {
        // Cursor region cannot be deleted
        if (region && region.regionId !== 0 && this.regions.length) {
            if (region === this.selectedRegion) {
                this.selectedRegion = this.regions[0];
            }
            this.regions = this.regions.filter(r => r !== region);
            this.backendService.removeRegion(region.regionId);
        }
    };

    @action setNewRegionType = (type: CARTA.RegionType) => {
        this.newRegionType = type;
    };

    @action setMode = (mode) => {
        this.mode = mode;
    };

    @action toggleMode = () => {
        this.mode = (this.mode === RegionMode.MOVING) ? RegionMode.CREATING : RegionMode.MOVING;
    };
}