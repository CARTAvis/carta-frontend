import * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";
import {action, computed, makeObservable, observable} from "mobx";

import {Point2D, Transform2D} from "models";
import {BackendService} from "services";
import {PreferenceStore} from "stores";
import {CompassAnnotationStore, CURSOR_REGION_ID, FrameStore, PointAnnotationStore, RegionStore, RulerAnnotationStore, TextAnnotationStore, VectorAnnotationStore} from "stores/Frame";
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
    private pointShapeCache: CARTA.PointAnnotationShape;

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

    /**
     * Returns an array of region IDs and types in the region set.
     */
    @computed get regionList(): {id: number; type: CARTA.RegionType}[] {
        return this.regions.map(r => {
            return {id: r.regionId, type: r.regionType};
        });
    }

    /**
     * Returns a map associating region IDs with their corresponding RegionStore instances.
     */
    @computed get regionMap(): Map<number, RegionStore> {
        const regionMap = new Map<number, RegionStore>();

        for (const region of this.regions) {
            regionMap.set(region.regionId, region);
        }

        return regionMap;
    }

    @computed get regionsAndAnnotationsForRender(): RegionStore[] {
        return this.regions?.filter(r => r.isValid && r.regionId !== 0)?.sort((a, b) => (a.boundingBoxArea > b.boundingBoxArea ? -1 : 1));
    }

    @computed get isNewRegionAnnotation(): boolean {
        return RegionStore.AVAILABLE_ANNOTATION_TYPES.has(this.newRegionType);
    }

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

    @action addLineRegion = (points: Point2D[], temporary: boolean = false) => {
        return this.addRegion(points, 0, CARTA.RegionType.LINE, temporary);
    };

    @action addPolylineRegion = (points: Point2D[], temporary: boolean = false) => {
        return this.addRegion(points, 0, CARTA.RegionType.POLYLINE, temporary);
    };
    @action addAnnPointRegion = (center: Point2D, shape: CARTA.PointAnnotationShape, cursorRegion = false) => {
        this.pointShapeCache = shape;
        return this.addRegion([center], 0, CARTA.RegionType.ANNPOINT, cursorRegion, this.getTempRegionId());
    };

    @action addAnnRectangularRegion = (center: Point2D, width: number, height: number, temporary: boolean = false) => {
        return this.addRegion([center, {x: width, y: height}], 0, CARTA.RegionType.ANNRECTANGLE, temporary);
    };

    @action addAnnEllipticalRegion = (center: Point2D, semiMajor: number, semiMinor: number, temporary: boolean = false) => {
        return this.addRegion([center, {x: semiMinor, y: semiMajor}], 0, CARTA.RegionType.ANNELLIPSE, temporary);
    };

    @action addAnnPolygonalRegion = (points: Point2D[], temporary: boolean = false) => {
        return this.addRegion(points, 0, CARTA.RegionType.ANNPOLYGON, temporary);
    };

    @action addAnnLineRegion = (points: Point2D[], temporary: boolean = false) => {
        return this.addRegion(points, 0, CARTA.RegionType.ANNLINE, temporary);
    };

    @action addAnnPolylineRegion = (points: Point2D[], temporary: boolean = false) => {
        return this.addRegion(points, 0, CARTA.RegionType.ANNPOLYLINE, temporary);
    };

    @action addAnnVectorRegion = (points: Point2D[], temporary: boolean = false) => {
        return this.addRegion(points, 0, CARTA.RegionType.ANNVECTOR, temporary);
    };

    @action addAnnTextRegion = (center: Point2D, width: number, height: number, temporary: boolean = false) => {
        return this.addRegion([center, {x: width, y: height}], 0, CARTA.RegionType.ANNTEXT, temporary);
    };

    @action addAnnCompassRegion = (point: Point2D, length: number, temporary: boolean = false) => {
        return this.addRegion([point, {x: length, y: length}], 0, CARTA.RegionType.ANNCOMPASS, temporary);
    };

    @action addAnnRulerRegion = (points: Point2D[], temporary: boolean = false) => {
        return this.addRegion(points, 0, CARTA.RegionType.ANNRULER, temporary);
    };

    @action addExistingRegion = (points: Point2D[], rotation: number, regionType: CARTA.RegionType, regionId: number, name: string, color: string, lineWidth: number, dashes: number[], temporary = true, annotationStyles?: any) => {
        const region = this.addRegion(points, rotation, regionType, temporary, regionId, name);
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

        if (annotationStyles) {
            switch (regionType) {
                case CARTA.RegionType.ANNPOINT:
                    (region as PointAnnotationStore).initializeStyles(annotationStyles);
                    break;
                case CARTA.RegionType.ANNTEXT:
                    (region as TextAnnotationStore).initializeStyles(annotationStyles);
                    break;
                case CARTA.RegionType.ANNVECTOR:
                    (region as VectorAnnotationStore).initializeStyles(annotationStyles);
                    break;
                case CARTA.RegionType.ANNCOMPASS:
                    (region as CompassAnnotationStore).initializeStyles(annotationStyles);
                    break;
                case CARTA.RegionType.ANNRULER:
                    (region as RulerAnnotationStore).initializeStyles(annotationStyles);
                    break;
                default:
                    break;
            }
        }

        return region;
    };

    /**
     * Adds a new region and returns the corresponding RegionStore object.
     *
     * @param regionType - Type of the region.
     * @param points - Points defining the shape of the region. For rectangles, ellipses, text annotations, and compass annotations, provide [center, size]; for other types, provide an array of positions.
     * @param rotation - Rotation angle of the region in degrees. Only applicable for rectangles, ellipses, and text annotations.
     * @param regionName - Optional name for the region. If it is not provided or is an empty string, a default name will be applied.
     * @returns A promise that resolves to the RegionStore object representing the added region.
     */
    addRegionAsync = async (regionType: CARTA.RegionType, points: Point2D[], rotation: number = 0, regionName: string = ""): Promise<RegionStore> => {
        const tempRegionId = this.getTempRegionId();
        const region = this.initRegion(points, rotation, regionType, tempRegionId, regionName);
        this.regions.push(region);

        try {
            await this.requestSetRegion(this.frame.frameInfo.fileId, region);
        } catch (err) {
            console.log(err);
        }

        return region;
    };

    private addRegion = (points: Point2D[], rotation: number, regionType: CARTA.RegionType, temporary: boolean = false, regionId: number = this.getTempRegionId(), regionName: string = "") => {
        const region = this.initRegion(points, rotation, regionType, regionId, regionName);
        this.regions.push(region);

        if (!temporary) {
            this.requestSetRegion(this.frame.frameInfo.fileId, region);
        }

        return region;
    };

    private initRegion = (points: Point2D[], rotation: number, regionType: CARTA.RegionType, regionId: number, regionName: string): RegionStore => {
        type CommonInputs = [BackendService, number, FrameStore, Point2D[], CARTA.RegionType, number, number, string];
        type StyleInputs = [string, number, number];
        const commonInputs: CommonInputs = [this.backendService, this.frame.frameInfo.fileId, this.frame, points, regionType, regionId, rotation, regionName];
        const regionStyles: StyleInputs = [this.preference.regionColor, this.preference.regionLineWidth, this.preference.regionDashLength];
        const annotationStyles: StyleInputs = [this.preference.annotationColor, this.preference.annotationLineWidth, this.preference.annotationDashLength];

        switch (regionType) {
            case CARTA.RegionType.ANNCOMPASS:
                return new CompassAnnotationStore(...commonInputs, ...annotationStyles);
            case CARTA.RegionType.ANNRULER:
                return new RulerAnnotationStore(...commonInputs, ...annotationStyles);
            case CARTA.RegionType.ANNTEXT:
                return new TextAnnotationStore(...commonInputs, this.preference.annotationColor, this.preference.textAnnotationLineWidth, this.preference.annotationDashLength);
            case CARTA.RegionType.ANNPOINT:
                return new PointAnnotationStore(...commonInputs, ...annotationStyles, this.pointShapeCache || this.preference.pointAnnotationShape, this.preference.pointAnnotationWidth);
            case CARTA.RegionType.ANNVECTOR:
                return new VectorAnnotationStore(...commonInputs, ...annotationStyles);
            case CARTA.RegionType.ANNELLIPSE:
            case CARTA.RegionType.ANNRECTANGLE:
            case CARTA.RegionType.ANNPOLYGON:
            case CARTA.RegionType.ANNPOLYLINE:
            case CARTA.RegionType.ANNLINE:
                return new RegionStore(...commonInputs, ...annotationStyles);
            default:
                return new RegionStore(...commonInputs, ...regionStyles);
        }
    };

    private requestSetRegion = async (fileId: number, region: RegionStore) => {
        try {
            const ack = await this.backendService.setRegion(fileId, -1, region);
            console.log(`Updating regionID from ${region.regionId} to ${ack.regionId}`);
            region.setRegionId(ack.regionId);
        } catch (err) {
            console.log(err);
        }
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

    @action migrateRegionsFromExistingSet = (sourceRegionSet: RegionSetStore, spatialTransformAST: AST.Mapping, forward: boolean = false) => {
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

                let annotationStyles;

                switch (region.regionType) {
                    case CARTA.RegionType.ANNELLIPSE:
                    case CARTA.RegionType.ANNTEXT:
                    case CARTA.RegionType.ANNCOMPASS:
                    case CARTA.RegionType.RECTANGLE:
                    case CARTA.RegionType.ANNRECTANGLE:
                    case CARTA.RegionType.ELLIPSE:
                        switch (region.regionType) {
                            case CARTA.RegionType.ANNTEXT:
                                annotationStyles = (region as TextAnnotationStore).getAnnotationStyles();
                                break;
                            case CARTA.RegionType.ANNCOMPASS:
                                annotationStyles = (region as CompassAnnotationStore).getAnnotationStyles();
                                break;
                        }

                        const centerNewFrame = transformPoint(spatialTransformAST, region.center, forward);
                        if (!isAstBadPoint(centerNewFrame)) {
                            const transform = new Transform2D(spatialTransformAST, centerNewFrame);
                            const size = scale2D(region.size, forward ? transform.scale : 1.0 / transform.scale);
                            rotation = region.rotation + ((forward ? 1 : -1) * transform.rotation * 180) / Math.PI;
                            newControlPoints = [centerNewFrame, size];
                        }
                        break;
                    case CARTA.RegionType.POINT:
                    case CARTA.RegionType.POLYGON:
                    case CARTA.RegionType.ANNPOLYGON:
                    case CARTA.RegionType.LINE:
                    case CARTA.RegionType.ANNLINE:
                    case CARTA.RegionType.POLYLINE:
                    case CARTA.RegionType.ANNPOLYLINE:
                    case CARTA.RegionType.ANNPOINT:
                    case CARTA.RegionType.ANNVECTOR:
                    case CARTA.RegionType.ANNRULER:
                        switch (region.regionType) {
                            case CARTA.RegionType.ANNPOINT:
                                annotationStyles = (region as PointAnnotationStore).getAnnotationStyles();
                                break;
                            case CARTA.RegionType.ANNVECTOR:
                                annotationStyles = (region as VectorAnnotationStore).getAnnotationStyles();
                                break;
                            case CARTA.RegionType.ANNRULER:
                                annotationStyles = (region as RulerAnnotationStore).getAnnotationStyles();
                                break;
                        }

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
                    if (region.regionType === CARTA.RegionType.POINT) {
                        newRegion = this.addRegion(newControlPoints, 0, CARTA.RegionType.POINT);
                        newRegion.setName(region.name);
                        newRegion.setColor(region.color);
                    } else if (region.regionType === CARTA.RegionType.ANNPOINT) {
                        newRegion = this.addRegion(newControlPoints, 0, CARTA.RegionType.ANNPOINT);
                        newRegion.setName(region.name);
                        newRegion.setColor(region.color);
                        (newRegion as PointAnnotationStore).initializeStyles(annotationStyles);
                    } else {
                        newRegion = this.addExistingRegion(newControlPoints, rotation, region.regionType, newId, region.name, region.color, region.lineWidth, region.dashLength ? [region.dashLength] : [], annotationStyles);
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
