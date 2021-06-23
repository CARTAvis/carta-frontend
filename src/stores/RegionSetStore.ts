import {action, observable, makeObservable} from "mobx";
import * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";
import {CURSOR_REGION_ID, FrameStore, PreferenceStore, RegionStore} from "stores";
import {Point2D, Transform2D} from "models";
import {BackendService} from "../services";
import {isAstBadPoint, scale2D, transformPoint} from "../utilities";

export enum RegionMode {
    MOVING,
    CREATING
}

export class RegionSetStore {
    @observable regions: RegionStore[];
    @observable selectedRegion: RegionStore;
    @observable mode: RegionMode;
    @observable newRegionType: CARTA.RegionType;

    private readonly frame: FrameStore;
    private readonly backendService: BackendService;
    private readonly preference: PreferenceStore;

    constructor(frame: FrameStore, preference: PreferenceStore, backendService: BackendService) {
        makeObservable(this);
        this.frame = frame;
        this.backendService = backendService;
        this.preference = preference;
        this.regions = [];
        this.newRegionType = preference.regionType;
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
        return this.addRegion([center], 0, CARTA.RegionType.POINT, cursorRegion, cursorRegion ? CURSOR_REGION_ID : this.getTempRegionId());
    };

    @action addRectangularRegion = (center: Point2D, width: number, height: number, temporary: boolean = false) => {
        return this.addRegion([center, {x: width, y: height}], 0, CARTA.RegionType.RECTANGLE, temporary);
    };

    @action addEllipticalRegion = (center: Point2D, semiMajor: number, semiMinor: number, temporary: boolean = false) => {
        return this.addRegion([center, {x: semiMinor, y: semiMajor}], 0, CARTA.RegionType.ELLIPSE, temporary);
    };

    @action addPolygonalRegion = (points: Point2D[], temporary: boolean = false) => {
        return this.addRegion(points, 0, CARTA.RegionType.POLYGON, temporary);
    };

    @action addExistingRegion = (points: Point2D[], rotation: number, regionType: CARTA.RegionType, regionId: number, name: string, color: string, lineWidth: number, dashes: number[]) => {
        const region = this.addRegion(points, rotation, regionType, true, regionId, name);
        // additional imported style properties;
        if (color) {
            region.color = color;
        }
        if (lineWidth) {
            region.lineWidth = lineWidth;
        }
        if (dashes?.length) {
            region.dashLength = dashes[0];
        }
        return region;
    };

    private addRegion(points: Point2D[], rotation: number, regionType: CARTA.RegionType, temporary: boolean = false, regionId: number = this.getTempRegionId(), regionName: string = "") {
        const region = new RegionStore(
            this.backendService,
            this.frame.frameInfo.fileId,
            this.frame,
            points,
            regionType,
            regionId,
            this.preference.regionColor,
            this.preference.regionLineWidth,
            this.preference.regionDashLength,
            rotation,
            regionName
        );
        this.regions.push(region);
        if (!temporary) {
            this.backendService.setRegion(this.frame.frameInfo.fileId, -1, region).then(
                ack => {
                    console.log(`Updating regionID from ${region.regionId} to ${ack.regionId}`);
                    region.setRegionId(ack.regionId);
                },
                err => console.log(err)
            );
        }

        return region;
    }

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
        if (region && region.regionId !== CURSOR_REGION_ID && this.regions.length) {
            if (region === this.selectedRegion) {
                this.selectedRegion = this.regions[0];
            }
            this.regions = this.regions.filter(r => r !== region);
            if (!region.isTemporary) {
                this.backendService.removeRegion(region.regionId);
            }
        }
    };

    @action setNewRegionType = (type: CARTA.RegionType) => {
        this.newRegionType = type;
    };

    @action setMode = mode => {
        this.mode = mode;
    };

    @action toggleMode = () => {
        this.mode = this.mode === RegionMode.MOVING ? RegionMode.CREATING : RegionMode.MOVING;
    };

    @action migrateRegionsFromExistingSet = (sourceRegionSet: RegionSetStore, spatialTransformAST: AST.FrameSet, forward: boolean = false) => {
        if (sourceRegionSet?.regions?.length <= 1) {
            return;
        }

        let newId = -1;
        for (const region of sourceRegionSet.regions) {
            // skip duplicates
            const duplicateRegion = this.regions.find(r => r.modifiedTimestamp === region.modifiedTimestamp);
            if (duplicateRegion) {
                continue;
            }

            if (region.regionId === CURSOR_REGION_ID) {
                const centerNewFrame = transformPoint(spatialTransformAST, region.center, forward);
                if (this.regions.length && this.regions[0].regionId === CURSOR_REGION_ID) {
                    this.regions[0].setCenter(centerNewFrame);
                }
            } else {
                let newControlPoints: Point2D[] = [];
                let rotation: number = 0;

                if (region.regionType === CARTA.RegionType.RECTANGLE || region.regionType === CARTA.RegionType.ELLIPSE) {
                    const centerNewFrame = transformPoint(spatialTransformAST, region.center, forward);
                    if (!isAstBadPoint(centerNewFrame)) {
                        const transform = new Transform2D(spatialTransformAST, centerNewFrame);
                        const size = scale2D(region.size, forward ? transform.scale : 1.0 / transform.scale);
                        rotation = region.rotation + ((forward ? 1 : -1) * transform.rotation * 180) / Math.PI;
                        newControlPoints = [centerNewFrame, size];
                    }
                } else if (region.regionType === CARTA.RegionType.POINT || region.regionType === CARTA.RegionType.POLYGON) {
                    for (const point of region.controlPoints) {
                        const pointNewFrame = transformPoint(spatialTransformAST, point, forward);
                        if (!isAstBadPoint(pointNewFrame)) {
                            newControlPoints.push(pointNewFrame);
                        }
                    }
                }

                if (newControlPoints.length) {
                    let newRegion: RegionStore;
                    if (region.regionType === CARTA.RegionType.POINT) {
                        newRegion = this.addRegion(newControlPoints, 0, CARTA.RegionType.POINT);
                        newRegion.setName(region.name);
                        newRegion.setColor(region.color);
                    } else {
                        newRegion = this.addExistingRegion(newControlPoints, rotation, region.regionType, newId, region.name, region.color, region.lineWidth, region.dashLength ? [region.dashLength] : []);
                        newRegion.endCreating();
                    }
                    newRegion.setLocked(region.locked);
                    // Link the two regions together
                    newRegion.modifiedTimestamp = region.modifiedTimestamp;
                    newId--;
                }
            }
        }
    };
}
