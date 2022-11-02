import {action, computed, observable, makeObservable} from "mobx";
import * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";
import {PreferenceStore} from "stores";
import {CURSOR_REGION_ID, FrameStore, RegionStore, CompassAnnotationStore, RulerAnnotationStore, TextAnnotationStore, PointAnnotationStore, VectorAnnotationStore} from "stores/Frame";
import {Point2D, Transform2D} from "models";
import {BackendService} from "services";
import {isAstBadPoint, scale2D, transformPoint} from "utilities";

export enum RegionMode {
    MOVING,
    CREATING
}

export enum RegionsOpacity {
    Visible = 1,
    SemiTransparent = 0.5,
    Invisible = 0
}

export class RegionSetStore {
    @observable regions: RegionStore[];
    @observable selectedRegion: RegionStore;
    @observable mode: RegionMode;
    @observable newRegionType: CARTA.RegionType;
    @observable opacity: number = 1;
    @observable locked: boolean = false;
    @observable isHoverImage: Boolean = false;

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
        this.addPointRegion(frame.center, true);
        this.selectedRegion = this.regions[0];
    }

    public updateCursorRegionPosition = (pos: Point2D) => {
        if (pos && this.regions.length > 0) {
            const cursorRegion = this.regions[0];
            // Need to avoid redundant update (position not changed), backend may not reply to redundant requests.
            const roundedPos = {x: Math.round(pos.x), y: Math.round(pos.y)};
            if (cursorRegion?.regionId === CURSOR_REGION_ID && (!this.isHoverImage || cursorRegion.center?.x !== roundedPos.x || cursorRegion.center?.y !== roundedPos.y)) {
                cursorRegion.setCenter(roundedPos);
                this.setIsHover(true);
            }
        }
    };

    @action setIsHover = (bool: boolean) => {
        this.isHoverImage = bool;
    };

    // temporary region IDs are < 0 and used
    private getTempRegionId = () => {
        let regionId = -1;
        if (this.regions.length) {
            let minRegionId = Math.min(...this.regions.map(r => r.regionId));
            regionId = Math.min(regionId, minRegionId - 1);
        }
        return regionId;
    };

    @computed get regionsAndAnnotationsForRender(): RegionStore[] {
        return this.regions?.filter(r => r.isValid && r.regionId !== 0)?.sort((a, b) => (a.boundingBoxArea > b.boundingBoxArea ? -1 : 1));
    }

    @action addPointRegion = (center: Point2D, cursorRegion = false) => {
        return this.addRegion([center], 0, CARTA.RegionType.POINT, cursorRegion, false, cursorRegion ? CURSOR_REGION_ID : this.getTempRegionId());
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

    @action addLineRegion = (points: Point2D[], temporary: boolean = false) => {
        return this.addRegion(points, 0, CARTA.RegionType.LINE, temporary);
    };

    @action addPolylineRegion = (points: Point2D[], temporary: boolean = false) => {
        return this.addRegion(points, 0, CARTA.RegionType.POLYLINE, temporary);
    };
    @action addAnnPointRegion = (center: Point2D, cursorRegion = false) => {
        return this.addRegion([center], 0, CARTA.RegionType.ANNPOINT, cursorRegion, true, this.getTempRegionId());
    };

    @action addAnnRectangularRegion = (center: Point2D, width: number, height: number, temporary: boolean = false) => {
        return this.addRegion([center, {x: width, y: height}], 0, CARTA.RegionType.ANNRECTANGLE, temporary, true);
    };

    @action addAnnEllipticalRegion = (center: Point2D, semiMajor: number, semiMinor: number, temporary: boolean = false) => {
        return this.addRegion([center, {x: semiMinor, y: semiMajor}], 0, CARTA.RegionType.ANNELLIPSE, temporary, true);
    };

    @action addAnnPolygonalRegion = (points: Point2D[], temporary: boolean = false) => {
        return this.addRegion(points, 0, CARTA.RegionType.ANNPOLYGON, temporary, true);
    };

    @action addAnnLineRegion = (points: Point2D[], temporary: boolean = false) => {
        return this.addRegion(points, 0, CARTA.RegionType.ANNLINE, temporary, true);
    };

    @action addAnnPolylineRegion = (points: Point2D[], temporary: boolean = false) => {
        return this.addRegion(points, 0, CARTA.RegionType.ANNPOLYLINE, temporary, true);
    };

    @action addAnnVectorRegion = (points: Point2D[], temporary: boolean = false) => {
        return this.addRegion(points, 0, CARTA.RegionType.ANNVECTOR, temporary, true);
    };

    @action addAnnTextRegion = (center: Point2D, width: number, height: number, temporary: boolean = false) => {
        return this.addRegion([center, {x: width, y: height}], 0, CARTA.RegionType.ANNTEXT, temporary, true);
    };

    @action addAnnCompassRegion = (points: Point2D[], temporary: boolean = false) => {
        return this.addRegion(points, 0, CARTA.RegionType.ANNCOMPASS, temporary, true);
    };

    @action addAnnRulerRegion = (points: Point2D[], temporary: boolean = false) => {
        return this.addRegion(points, 0, CARTA.RegionType.ANNRULER, temporary, true);
    };

    @action addExistingRegion = (points: Point2D[], rotation: number, regionType: CARTA.RegionType, regionId: number, name: string, color: string, lineWidth: number, dashes: number[]) => {
        const region = this.addRegion(points, rotation, regionType, true, false, regionId, name);
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

    private addRegion(points: Point2D[], rotation: number, regionType: CARTA.RegionType, temporary: boolean = false, isAnnotation: boolean = false, regionId: number = this.getTempRegionId(), regionName: string = "") {
        let region: RegionStore;

        switch (regionType) {
            case CARTA.RegionType.ANNCOMPASS:
                region = new CompassAnnotationStore(
                    this.backendService,
                    this.frame.frameInfo.fileId,
                    this.frame,
                    points,
                    regionType,
                    regionId,
                    this.preference.annotationColor,
                    this.preference.annotationLineWidth,
                    this.preference.annotationDashLength,
                    rotation,
                    regionName
                );
                break;
            case CARTA.RegionType.ANNRULER:
                region = new RulerAnnotationStore(
                    this.backendService,
                    this.frame.frameInfo.fileId,
                    this.frame,
                    points,
                    regionType,
                    regionId,
                    this.preference.annotationColor,
                    this.preference.annotationLineWidth,
                    this.preference.annotationDashLength,
                    rotation,
                    regionName
                );
                break;
            case CARTA.RegionType.ANNTEXT:
                region = new TextAnnotationStore(
                    this.backendService,
                    this.frame.frameInfo.fileId,
                    this.frame,
                    points,
                    regionType,
                    regionId,
                    this.preference.annotationColor,
                    this.preference.annotationLineWidth,
                    this.preference.annotationDashLength,
                    rotation,
                    regionName
                );
                break;
            case CARTA.RegionType.ANNPOINT:
                region = new PointAnnotationStore(
                    this.backendService,
                    this.frame.frameInfo.fileId,
                    this.frame,
                    points,
                    regionType,
                    regionId,
                    this.preference.annotationColor,
                    this.preference.annotationLineWidth,
                    this.preference.annotationDashLength,
                    this.preference.pointAnnotationShape,
                    this.preference.pointAnnotationWidth,
                    rotation,
                    regionName
                );
                break;
            case CARTA.RegionType.ANNVECTOR:
                region = new VectorAnnotationStore(
                    this.backendService,
                    this.frame.frameInfo.fileId,
                    this.frame,
                    points,
                    regionType,
                    regionId,
                    this.preference.annotationColor,
                    this.preference.annotationLineWidth,
                    this.preference.annotationDashLength,
                    rotation,
                    regionName
                );
                break;
            case CARTA.RegionType.ANNELLIPSE:
            case CARTA.RegionType.ANNRECTANGLE:
            case CARTA.RegionType.ANNPOLYGON:
            case CARTA.RegionType.ANNPOLYLINE:
            case CARTA.RegionType.ANNLINE:
                region = new RegionStore(
                    this.backendService,
                    this.frame.frameInfo.fileId,
                    this.frame,
                    points,
                    regionType,
                    regionId,
                    this.preference.annotationColor,
                    this.preference.annotationLineWidth,
                    this.preference.annotationDashLength,
                    rotation,
                    regionName
                );
                break;
            default:
                region = new RegionStore(
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
                break;
        }

        this.regions.push(region);
        //Need to be removed
        if (!temporary) {
            this.backendService.setRegion(this.frame.frameInfo.fileId, -1, region).then(
                ack => {
                    console.log(`Updating regionID from ${region.regionId} to ${ack.regionId}`);
                    region.setRegionId(ack.regionId);
                },
                err => {
                    console.log(err);
                }
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

        const dstRegionTimestamps = this.regions.map(r => r.modifiedTimestamp);
        let newId = -1;
        for (const region of sourceRegionSet.regions) {
            // skip duplicates
            const duplicateRegion = dstRegionTimestamps.find(t => t === region.modifiedTimestamp);
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

                switch (region.regionType) {
                    case CARTA.RegionType.RECTANGLE:
                    case CARTA.RegionType.ANNRECTANGLE:
                    case CARTA.RegionType.ELLIPSE:
                    case CARTA.RegionType.ANNELLIPSE:
                    case CARTA.RegionType.ANNTEXT:
                        const centerNewFrame = transformPoint(spatialTransformAST, region.center, forward);
                        if (!isAstBadPoint(centerNewFrame)) {
                            const transform = new Transform2D(spatialTransformAST, centerNewFrame);
                            const size = scale2D(region.size, forward ? transform.scale : 1.0 / transform.scale);
                            rotation = region.rotation + ((forward ? 1 : -1) * transform.rotation * 180) / Math.PI;
                            newControlPoints = [centerNewFrame, size];
                        }
                        break;
                    case CARTA.RegionType.POINT:
                    case CARTA.RegionType.ANNPOINT:
                    case CARTA.RegionType.POLYGON:
                    case CARTA.RegionType.ANNPOLYGON:
                    case CARTA.RegionType.LINE:
                    case CARTA.RegionType.ANNLINE:
                    case CARTA.RegionType.POLYLINE:
                    case CARTA.RegionType.ANNPOLYLINE:
                        for (const point of region.controlPoints) {
                            const pointNewFrame = transformPoint(spatialTransformAST, point, forward);
                            if (!isAstBadPoint(pointNewFrame)) {
                                newControlPoints.push(pointNewFrame);
                            }
                        }
                        break;
                    default:
                        break;
                }

                if (newControlPoints.length) {
                    let newRegion: RegionStore;
                    if (region.regionType === CARTA.RegionType.POINT || region.regionType === CARTA.RegionType.ANNPOINT) {
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

    @action setOpacity(opacity: RegionsOpacity) {
        this.opacity = opacity;
    }

    @action setLocked(locked?: boolean) {
        this.locked = locked === undefined ? !this.locked : locked;
        if (this.locked) {
            this.selectRegionByIndex(0);
        }
    }
}
