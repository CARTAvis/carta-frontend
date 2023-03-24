import {Colors, IconName} from "@blueprintjs/core";
import * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";
import {throttle} from "lodash";
import {action, computed, flow, makeObservable, observable} from "mobx";

import {CustomIconName} from "icons/CustomIcons";
import {Point2D} from "models";
import {BackendService} from "services";
import {AppStore} from "stores";
import {CoordinateMode, FrameStore} from "stores/Frame";
import {add2D, getApproximateEllipsePoints, getApproximatePolygonPoints, isAstBadPoint, length2D, midpoint2D, minMax2D, rotate2D, scale2D, simplePolygonPointTest, simplePolygonTest, subtract2D, toFixed, transformPoint} from "utilities";

export const CURSOR_REGION_ID = 0;
export const FOCUS_REGION_RATIO = 0.4;

export const CENTER_POINT_INDEX = 0;
export const SIZE_POINT_INDEX = 1;

export class RegionStore {
    readonly fileId: number;
    @observable regionId: number;
    @observable name: string;
    @observable color: string;
    @observable lineWidth: number;
    @observable dashLength: number;
    @observable regionType: CARTA.RegionType;
    @observable coordinate: CoordinateMode;
    // Shallow observable, since control point updates are atomic
    @observable.shallow controlPoints: Point2D[];
    @observable rotation: number;
    @observable editing: boolean;
    @observable creating: boolean;
    @observable locked: boolean = false;
    @observable isSimplePolygon: boolean;
    @observable activeFrame: FrameStore;

    static readonly MIN_LINE_WIDTH = 0.5;
    static readonly MAX_LINE_WIDTH = 10;
    static readonly MAX_DASH_LENGTH = 50;
    static readonly TARGET_VERTEX_COUNT = 200;

    private readonly backendService: BackendService;
    protected readonly regionApproximationMap: Map<AST.FrameSet, Point2D[]>;
    public modifiedTimestamp: number;

    public static RegionTypeString(regionType: CARTA.RegionType): string {
        switch (regionType) {
            case CARTA.RegionType.POINT:
                return "Point";
            case CARTA.RegionType.ANNPOINT:
                return "Point - Ann";
            case CARTA.RegionType.LINE:
                return "Line";
            case CARTA.RegionType.ANNLINE:
                return "Line - Ann";
            case CARTA.RegionType.RECTANGLE:
                return "Rectangle";
            case CARTA.RegionType.ANNRECTANGLE:
                return "Rectangle - Ann";
            case CARTA.RegionType.ELLIPSE:
                return "Ellipse";
            case CARTA.RegionType.ANNELLIPSE:
                return "Ellipse - Ann";
            case CARTA.RegionType.POLYGON:
                return "Polygon";
            case CARTA.RegionType.ANNPOLYGON:
                return "Polygon - Ann";
            case CARTA.RegionType.POLYLINE:
                return "Polyline";
            case CARTA.RegionType.ANNPOLYLINE:
                return "Polyline - Ann";
            case CARTA.RegionType.ANNVECTOR:
                return "Vector - Ann";
            case CARTA.RegionType.ANNTEXT:
                return "Text - Ann";
            case CARTA.RegionType.ANNCOMPASS:
                return "Compass - Ann";
            case CARTA.RegionType.ANNRULER:
                return "Ruler - Ann";
            default:
                return "Not Implemented";
        }
    }

    public static IsRegionCustomIcon(regionType: CARTA.RegionType): boolean {
        switch (regionType) {
            case CARTA.RegionType.LINE:
            case CARTA.RegionType.ANNLINE:
            case CARTA.RegionType.POLYLINE:
            case CARTA.RegionType.ANNPOLYLINE:
            case CARTA.RegionType.ANNRULER:
                return true;
            default:
                return false;
        }
    }

    public static RegionIconString(regionType: CARTA.RegionType): IconName | CustomIconName {
        switch (regionType) {
            case CARTA.RegionType.POINT:
            case CARTA.RegionType.ANNPOINT:
                return "symbol-square";
            case CARTA.RegionType.LINE:
            case CARTA.RegionType.ANNLINE:
                return "line";
            case CARTA.RegionType.RECTANGLE:
            case CARTA.RegionType.ANNRECTANGLE:
                return "square";
            case CARTA.RegionType.ELLIPSE:
            case CARTA.RegionType.ANNELLIPSE:
                return "circle";
            case CARTA.RegionType.POLYGON:
            case CARTA.RegionType.ANNPOLYGON:
                return "polygon-filter";
            case CARTA.RegionType.POLYLINE:
            case CARTA.RegionType.ANNPOLYLINE:
                return "polyline";
            case CARTA.RegionType.ANNVECTOR:
                return "arrow-top-right";
            case CARTA.RegionType.ANNCOMPASS:
                return "compass";
            case CARTA.RegionType.ANNTEXT:
                return "font";
            case CARTA.RegionType.ANNRULER:
                return "distanceMeasuring";
            default:
                return "error";
        }
    }

    static readonly AVAILABLE_REGION_TYPES = new Map<CARTA.RegionType, string>([
        [CARTA.RegionType.POINT, "Point"],
        [CARTA.RegionType.LINE, "Line"],
        [CARTA.RegionType.RECTANGLE, "Rectangle"],
        [CARTA.RegionType.ELLIPSE, "Ellipse"],
        [CARTA.RegionType.POLYGON, "Polygon"],
        [CARTA.RegionType.POLYLINE, "Polyline"]
    ]);

    static readonly AVAILABLE_ANNOTATION_TYPES = new Map<CARTA.RegionType, string>([
        [CARTA.RegionType.ANNPOINT, "Point"],
        [CARTA.RegionType.ANNLINE, "Line"],
        [CARTA.RegionType.ANNRECTANGLE, "Rectangle"],
        [CARTA.RegionType.ANNELLIPSE, "Ellipse"],
        [CARTA.RegionType.ANNPOLYGON, "Polygon"],
        [CARTA.RegionType.ANNPOLYLINE, "Polyline"],
        [CARTA.RegionType.ANNVECTOR, "Vector"],
        [CARTA.RegionType.ANNTEXT, "Text"],
        [CARTA.RegionType.ANNCOMPASS, "Compass"],
        [CARTA.RegionType.ANNRULER, "Ruler"]
    ]);

    public static IsRegionTypeValid(regionType: CARTA.RegionType): boolean {
        return RegionStore.AVAILABLE_REGION_TYPES.has(regionType);
    }

    public static IsRegionLineWidthValid(regionLineWidth: number): boolean {
        return regionLineWidth >= RegionStore.MIN_LINE_WIDTH && regionLineWidth <= RegionStore.MAX_LINE_WIDTH;
    }

    public static IsRegionDashLengthValid(regionDashLength: number): boolean {
        return regionDashLength >= 0 && regionDashLength <= RegionStore.MAX_DASH_LENGTH;
    }

    @computed get isTemporary(): boolean {
        return this.regionId < 0;
    }

    @computed get center(): Point2D {
        if (!this.isValid) {
            return {x: 0, y: 0};
        }
        switch (this.regionType) {
            case CARTA.RegionType.POINT:
            case CARTA.RegionType.ANNPOINT:
            case CARTA.RegionType.RECTANGLE:
            case CARTA.RegionType.ANNRECTANGLE:
            case CARTA.RegionType.ELLIPSE:
            case CARTA.RegionType.ANNELLIPSE:
            case CARTA.RegionType.ANNTEXT:
            case CARTA.RegionType.ANNCOMPASS:
                return this.controlPoints[CENTER_POINT_INDEX];
            case CARTA.RegionType.POLYGON:
            case CARTA.RegionType.ANNPOLYGON:
            case CARTA.RegionType.POLYLINE:
            case CARTA.RegionType.ANNPOLYLINE:
                const bounds = minMax2D(this.controlPoints);
                return midpoint2D(bounds.minPoint, bounds.maxPoint);
            case CARTA.RegionType.LINE:
            case CARTA.RegionType.ANNLINE:
            case CARTA.RegionType.ANNVECTOR:
            case CARTA.RegionType.ANNRULER:
                return midpoint2D(this.controlPoints[0], this.controlPoints[1]);
            default:
                return {x: 0, y: 0};
        }
    }

    @computed get size(): Point2D {
        switch (this.regionType) {
            case CARTA.RegionType.RECTANGLE:
            case CARTA.RegionType.ANNRECTANGLE:
            case CARTA.RegionType.ELLIPSE:
            case CARTA.RegionType.ANNELLIPSE:
            case CARTA.RegionType.ANNTEXT:
            case CARTA.RegionType.ANNCOMPASS:
                return this.controlPoints[SIZE_POINT_INDEX];
            case CARTA.RegionType.POLYGON:
            case CARTA.RegionType.ANNPOLYGON:
            case CARTA.RegionType.POLYLINE:
            case CARTA.RegionType.ANNPOLYLINE:
                return this.boundingBox;
            case CARTA.RegionType.LINE:
            case CARTA.RegionType.ANNLINE:
            case CARTA.RegionType.ANNVECTOR:
            case CARTA.RegionType.ANNRULER:
                return subtract2D(this.controlPoints[0], this.controlPoints[1]);
            default:
                return {x: undefined, y: undefined};
        }
    }

    @computed get wcsSize(): Point2D {
        const frame = this.activeFrame;
        if (!this.size || !frame?.validWcs) {
            return {x: undefined, y: undefined};
        }
        return frame.getWcsSizeInArcsec(this.size);
    }

    @computed get boundingBox(): Point2D {
        if (!this.isValid) {
            return {x: 0, y: 0};
        }
        switch (this.regionType) {
            case CARTA.RegionType.RECTANGLE:
            case CARTA.RegionType.ANNRECTANGLE:
            case CARTA.RegionType.ANNTEXT:
                return this.size;
            case CARTA.RegionType.ELLIPSE:
            case CARTA.RegionType.ANNELLIPSE:
            case CARTA.RegionType.ANNCOMPASS:
                return scale2D(this.size, 2);
            case CARTA.RegionType.POLYGON:
            case CARTA.RegionType.ANNPOLYGON:
            case CARTA.RegionType.POLYLINE:
            case CARTA.RegionType.ANNPOLYLINE:
            case CARTA.RegionType.ANNRULER:
                const boundingBox = minMax2D(this.controlPoints);
                return subtract2D(boundingBox.maxPoint, boundingBox.minPoint);
            default:
                return {x: 0, y: 0};
        }
    }

    @computed get boundingBoxArea(): number {
        const box = this.boundingBox;
        return box.x * box.y;
    }

    @computed get isClosedRegion(): boolean {
        switch (this.regionType) {
            case CARTA.RegionType.RECTANGLE:
            case CARTA.RegionType.ELLIPSE:
            case CARTA.RegionType.POLYGON:
            case CARTA.RegionType.ANNULUS:
            case CARTA.RegionType.ANNTEXT:
                return true;
            default:
                return false;
        }
    }

    @computed get isValid(): boolean {
        // All regions require at least one control point
        if (!this.controlPoints || !this.controlPoints.length) {
            return false;
        }

        // Basic validation, ensuring that the region has the correct number of control points
        switch (this.regionType) {
            case CARTA.RegionType.POINT:
            case CARTA.RegionType.ANNPOINT:
                return this.controlPoints.length === 1;
            case CARTA.RegionType.RECTANGLE:
            case CARTA.RegionType.ANNRECTANGLE:
            case CARTA.RegionType.ELLIPSE:
            case CARTA.RegionType.ANNELLIPSE:
            case CARTA.RegionType.ANNCOMPASS:
                return this.controlPoints.length === 2 && this.size.x > 0 && this.size.y > 0;
            case CARTA.RegionType.ANNTEXT:
                return this.controlPoints.length === 2;
            case CARTA.RegionType.POLYGON:
            case CARTA.RegionType.ANNPOLYGON:
            case CARTA.RegionType.POLYLINE:
            case CARTA.RegionType.ANNPOLYLINE:
            case CARTA.RegionType.ANNRULER:
                return this.controlPoints.length >= 1;
            case CARTA.RegionType.LINE:
            case CARTA.RegionType.ANNLINE:
            case CARTA.RegionType.ANNVECTOR:
                return this.controlPoints.length === 1 || this.controlPoints.length === 2;
            default:
                return false;
        }
    }

    @computed get isAnnotation(): boolean {
        return RegionStore.AVAILABLE_ANNOTATION_TYPES.has(this.regionType);
    }

    @computed get nameString(): string {
        if (this.regionId === CURSOR_REGION_ID) {
            return "Cursor";
        } else if (this.name && this.name !== "") {
            return this.name;
        } else if (this.isAnnotation) {
            return `Annotation ${this.regionId > CURSOR_REGION_ID ? this.regionId : "..."}`;
        } else {
            // temporary region id < 0, use "..." for representation
            return `Region ${this.regionId > CURSOR_REGION_ID ? this.regionId : "..."}`;
        }
    }

    @computed get regionProperties(): string {
        return RegionStore.GetRegionProperties(this.regionType, this.controlPoints, this.rotation);
    }

    public static GetRegionProperties = (regionType: CARTA.RegionType, controlPoints: Point2D[], rotation: number): string => {
        const point = controlPoints[CENTER_POINT_INDEX];
        const center = isFinite(point.x) && isFinite(point.y) ? `${toFixed(point.x, 6)}pix, ${toFixed(point.y, 6)}pix` : "Invalid";

        switch (regionType) {
            case CARTA.RegionType.POINT:
                return `Point (pixel) [${center}]`;
            case CARTA.RegionType.LINE:
                let lineProperties = "Line (pixel) [";
                controlPoints.forEach((point, index) => {
                    lineProperties += isFinite(point.x) && isFinite(point.y) ? `[${toFixed(point.x, 6)}pix, ${toFixed(point.y, 6)}pix]` : "[Invalid]";
                    lineProperties += index !== controlPoints.length - 1 ? ", " : "]";
                });
                return lineProperties;
            case CARTA.RegionType.RECTANGLE:
                return `rotbox[[${center}], [${toFixed(controlPoints[SIZE_POINT_INDEX].x, 6)}pix, ${toFixed(controlPoints[SIZE_POINT_INDEX].y, 6)}pix], ${toFixed(rotation, 6)}deg]`;
            case CARTA.RegionType.ELLIPSE:
                return `ellipse[[${center}], [${toFixed(controlPoints[SIZE_POINT_INDEX].x, 6)}pix, ${toFixed(controlPoints[SIZE_POINT_INDEX].y, 6)}pix], ${toFixed(rotation, 6)}deg]`;
            case CARTA.RegionType.POLYGON:
                let polygonProperties = "poly[";
                controlPoints.forEach((point, index) => {
                    polygonProperties += isFinite(point.x) && isFinite(point.y) ? `[${toFixed(point.x, 6)}pix, ${toFixed(point.y, 6)}pix]` : "[Invalid]";
                    polygonProperties += index !== controlPoints.length - 1 ? ", " : "]";
                });
                return polygonProperties;
            case CARTA.RegionType.POLYLINE:
                let polylineProperties = "Polyline (pixel) [";
                controlPoints.forEach((point, index) => {
                    polylineProperties += isFinite(point.x) && isFinite(point.y) ? `[${toFixed(point.x, 6)}pix, ${toFixed(point.y, 6)}pix]` : "[Invalid]";
                    polylineProperties += index !== controlPoints.length - 1 ? ", " : "]";
                });
                return polylineProperties;
            default:
                return "Not Implemented";
        }
    };

    public getRegionApproximation(
        astTransform: AST.FrameSet
    ): Point2D[] | {northApproximatePoints: number[]; eastApproximatePoints: number[]} | {xApproximatePoints: number[]; yApproximatePoints: number[]; hypotenuseApproximatePoints: number[]} {
        let approximatePoints = this.regionApproximationMap.get(astTransform);
        if (!approximatePoints) {
            if (this.regionType === CARTA.RegionType.POINT) {
                approximatePoints = [transformPoint(astTransform, this.center, false)];
            }
            if (this.regionType === CARTA.RegionType.ELLIPSE || this.regionType === CARTA.RegionType.ANNELLIPSE) {
                approximatePoints = getApproximateEllipsePoints(astTransform, this.center, this.size.y, this.size.x, this.rotation, RegionStore.TARGET_VERTEX_COUNT);
            } else if (this.regionType === CARTA.RegionType.RECTANGLE || this.regionType === CARTA.RegionType.ANNRECTANGLE || this.regionType === CARTA.RegionType.ANNTEXT) {
                let halfWidth = this.size.x / 2;
                let halfHeight = this.size.y / 2;
                const rotation = (this.rotation * Math.PI) / 180.0;
                const points: Point2D[] = [
                    add2D(this.center, rotate2D({x: -halfWidth, y: -halfHeight}, rotation)),
                    add2D(this.center, rotate2D({x: +halfWidth, y: -halfHeight}, rotation)),
                    add2D(this.center, rotate2D({x: +halfWidth, y: +halfHeight}, rotation)),
                    add2D(this.center, rotate2D({x: -halfWidth, y: +halfHeight}, rotation))
                ];
                approximatePoints = getApproximatePolygonPoints(astTransform, points, RegionStore.TARGET_VERTEX_COUNT);
            } else if (this.regionType === CARTA.RegionType.POLYGON) {
                approximatePoints = getApproximatePolygonPoints(astTransform, this.controlPoints, RegionStore.TARGET_VERTEX_COUNT, !this.creating);
            } else {
                approximatePoints = getApproximatePolygonPoints(astTransform, this.controlPoints, RegionStore.TARGET_VERTEX_COUNT, false);
            }
            this.regionApproximationMap.set(astTransform, approximatePoints);
        }
        return approximatePoints;
    }

    private getLineAngle = (start: Point2D, end: Point2D): number => {
        let angle = (Math.atan((end.x - start.x) / (start.y - end.y)) * 180.0) / Math.PI;
        if (end.y > start.y) {
            angle += 180;
        }
        angle = (angle + 360) % 360;
        return angle;
    };

    constructor(
        backendService: BackendService,
        fileId: number,
        activeFrame: FrameStore,
        controlPoints: Point2D[],
        regionType: CARTA.RegionType,
        regionId: number = -1,
        color: string = Colors.TURQUOISE5,
        lineWidth: number = 2,
        dashLength: number = 0,
        rotation: number = 0,
        name: string = ""
    ) {
        makeObservable(this);
        this.fileId = fileId;
        this.activeFrame = activeFrame;
        this.controlPoints = controlPoints;
        this.regionType = regionType;
        this.regionId = regionId;
        this.name = name;
        this.color = color;
        this.lineWidth = lineWidth;
        this.dashLength = dashLength;
        this.rotation = rotation;
        this.backendService = backendService;
        if (activeFrame.validWcs) {
            this.coordinate = CoordinateMode.World;
        } else {
            this.coordinate = CoordinateMode.Image;
        }
        this.isSimplePolygon = true;

        // Force rotation to zero if image pixes are non-square
        if (!this.activeFrame?.hasSquarePixels) {
            this.rotation = 0;
        }

        this.regionApproximationMap = new Map<number, Point2D[]>();
        if (this.regionType === CARTA.RegionType.POLYGON || this.regionType === CARTA.RegionType.ANNPOLYGON) {
            this.simplePolygonTest();
        }
        if ((this.regionType === CARTA.RegionType.LINE || this.regionType === CARTA.RegionType.ANNLINE || this.regionType === CARTA.RegionType.ANNVECTOR) && controlPoints.length === 2) {
            this.rotation = this.controlPoints.length === 2 ? this.getLineAngle(this.controlPoints[0], this.controlPoints[1]) : 0;
        }
        this.modifiedTimestamp = performance.now();
    }

    @action setRegionId = (id: number) => {
        this.regionId = id;
    };

    @action setCenter = (p: Point2D, skipUpdate = false) => {
        if (this.regionType === CARTA.RegionType.LINE || this.regionType === CARTA.RegionType.ANNLINE || this.regionType === CARTA.RegionType.ANNVECTOR) {
            const rotation = (this.rotation * Math.PI) / 180.0;
            // the rotation angle is defined to be 0 at North (mostly in +y axis) and increases counter-clockwisely. This is
            // different from the usual definition in math where 0 degree is in the +x axis. The extra 90-degree offset swaps
            // cos and sin with a proper +/-1 constant applied.
            const dx = length2D(this.size) * Math.sin(rotation);
            const dy = length2D(this.size) * -1 * Math.cos(rotation);
            const newStart = {x: p.x - dx / 2, y: p.y - dy / 2};
            const newEnd = {x: p.x + dx / 2, y: p.y + dy / 2};
            this.setControlPoints([newStart, newEnd]);
        } else {
            this.setControlPoint(CENTER_POINT_INDEX, p, skipUpdate);
        }
    };

    @action setSize = (p: Point2D, skipUpdate = false) => {
        if (this.regionType === CARTA.RegionType.LINE || this.regionType === CARTA.RegionType.ANNLINE || this.regionType === CARTA.RegionType.ANNVECTOR) {
            const newStart = {x: this.center.x - p.x / 2, y: this.center.y - p.y / 2};
            const newEnd = {x: this.center.x + p.x / 2, y: this.center.y + p.y / 2};
            this.setControlPoints([newStart, newEnd]);
        } else {
            this.setControlPoint(SIZE_POINT_INDEX, p, skipUpdate);
        }
    };

    @action setControlPoint = (index: number, p: Point2D, skipUpdate = false) => {
        // Check for control point NaN values
        if (index >= 0 && index < this.controlPoints.length && !isAstBadPoint(p) && isFinite(p?.x) && isFinite(p?.y)) {
            this.regionApproximationMap.clear();
            this.modifiedTimestamp = performance.now();
            this.controlPoints[index] = p;
            if (!this.editing && !skipUpdate) {
                this.updateRegion();
            } else if (this.regionType === CARTA.RegionType.LINE && this.regionId !== -1 && !this.creating) {
                this.throttledUpdateRegion(true);
            }
            if (this.regionType === CARTA.RegionType.POLYGON || this.regionType === CARTA.RegionType.ANNPOLYGON) {
                this.simplePolygonTest(index);
            }

            if (this.regionType === CARTA.RegionType.LINE || this.regionType === CARTA.RegionType.ANNLINE || this.regionType === CARTA.RegionType.ANNVECTOR) {
                this.rotation = this.controlPoints.length === 2 ? this.getLineAngle(this.controlPoints[0], this.controlPoints[1]) : 0;
            }
        }
    };

    @action setControlPoints = (points: Point2D[], skipUpdate = false, shapeChanged = true) => {
        // Check for control point NaN values
        if (!points.length) {
            return;
        }

        for (const p of points) {
            if (isAstBadPoint(p) || !isFinite(p?.x) || !isFinite(p?.y)) {
                return;
            }
        }

        this.regionApproximationMap.clear();
        this.modifiedTimestamp = performance.now();
        this.controlPoints = points;
        if (shapeChanged && (this.regionType === CARTA.RegionType.POLYGON || this.regionType === CARTA.RegionType.ANNPOLYGON)) {
            this.simplePolygonTest();
        }

        if (this.regionType === CARTA.RegionType.LINE || this.regionType === CARTA.RegionType.ANNLINE || this.regionType === CARTA.RegionType.ANNVECTOR) {
            this.rotation = points.length === 2 ? this.getLineAngle(points[0], points[1]) : 0;
        }

        if (!this.editing && !skipUpdate) {
            this.updateRegion();
        } else if (this.regionType === CARTA.RegionType.LINE && this.regionId !== -1 && !this.creating) {
            this.throttledUpdateRegion(true);
        }
    };

    private simplePolygonTest(point: number = -1) {
        const points = this.controlPoints.slice();
        // Only allow optimised test if the polygon is currently marked as simple, to avoid cases where multiple line segments intersect
        if (point >= 0 && this.isSimplePolygon) {
            this.isSimplePolygon = simplePolygonPointTest(points, point) && simplePolygonPointTest(points, point - 1);
        } else {
            this.isSimplePolygon = simplePolygonTest(points);
        }
    }

    @action setRotation = (angle: number, skipUpdate = false) => {
        // Images with non-square pixels do not support rotations
        if (!this.activeFrame?.hasSquarePixels) {
            return;
        }
        if (this.regionType === CARTA.RegionType.LINE || this.regionType === CARTA.RegionType.ANNLINE || this.regionType === CARTA.RegionType.ANNVECTOR) {
            const rotation = (((angle + 360) % 360) * Math.PI) / 180.0;
            // the rotation angle is defined to be 0 at North (mostly in +y axis) and increases counter-clockwisely. This is
            // different from the usual definition in math where 0 degree is in the +x axis. The extra 90-degree offset swaps
            // cos and sin with a proper +/-1 constant applied.
            const dx = length2D(this.size) * Math.sin(rotation);
            const dy = -length2D(this.size) * Math.cos(rotation);
            const newStart = {x: this.center.x - dx / 2, y: this.center.y - dy / 2};
            const newEnd = {x: this.center.x + dx / 2, y: this.center.y + dy / 2};
            this.setControlPoints([newStart, newEnd]);
        } else {
            this.rotation = (angle + 360) % 360;
            this.regionApproximationMap.clear();
            this.modifiedTimestamp = performance.now();
            if (!this.editing && !skipUpdate) {
                this.updateRegion();
            }
        }
    };

    @action setName = (name: string) => {
        this.name = name;
    };

    // Appearance properties don't need to be sync'd with the backend
    @action setColor = (color: string) => {
        this.color = color;

        if (this.isAnnotation) {
            this.modifiedTimestamp = performance.now();
        }
    };

    @action setLineWidth = (lineWidth: number) => {
        this.lineWidth = lineWidth;

        if (this.isAnnotation) {
            this.modifiedTimestamp = performance.now();
        }
    };

    @action setDashLength = (dashLength: number) => {
        this.dashLength = dashLength;

        if (this.isAnnotation) {
            this.modifiedTimestamp = performance.now();
        }
    };

    @action beginCreating = () => {
        this.creating = true;
        this.editing = true;
    };

    @flow.bound *endCreating() {
        this.creating = false;
        this.editing = false;

        // re-calculate projected points when the status changes from unclosed to closed
        if (this.regionType === CARTA.RegionType.POLYGON) {
            this.regionApproximationMap.clear();
        }

        if (this.regionType !== CARTA.RegionType.POINT) {
            try {
                const ack = yield this.backendService.setRegion(this.fileId, -1, this);
                console.log(`Updating regionID from ${this.regionId} to ${ack.regionId}`);
                this.setRegionId(ack.regionId);
            } catch (err) {
                console.log(err);
            }
        }
    }

    @action beginEditing = () => {
        this.editing = true;
    };

    @action endEditing = () => {
        this.editing = false;
        this.updateRegion();
    };

    @action toggleLock = () => {
        if (this.regionId !== CURSOR_REGION_ID) {
            this.locked = !this.locked;
        }
    };

    @action setLocked = (locked: boolean) => {
        if (this.regionId !== CURSOR_REGION_ID) {
            this.locked = locked;
        }
    };

    @action focusCenter = () => {
        if (this.activeFrame) {
            this.activeFrame.setCenter(this.center.x, this.center.y);

            if (this.activeFrame.renderWidth < this.activeFrame.zoomLevel * this.boundingBox.x || this.activeFrame.renderHeight < this.activeFrame.zoomLevel * this.boundingBox.y) {
                const zoomLevel = FOCUS_REGION_RATIO * Math.min(this.activeFrame.renderWidth / this.boundingBox.x, this.activeFrame.renderHeight / this.boundingBox.y);
                this.activeFrame.setZoom(zoomLevel);
            }
        }
    };

    @action setCoordinate = (coordinate: CoordinateMode) => {
        if (coordinate) {
            this.coordinate = coordinate;
        }
    };

    // Update the region with the backend
    // TODO: Determine whether we should await when calling this function from above
    private updateRegion = async (isRequestingPreview?: boolean) => {
        if (this.isValid) {
            if (this.regionId === CURSOR_REGION_ID) {
                AppStore.Instance.resetCursorRegionSpectralProfileProgress(this.fileId);
                this.backendService.setCursor(this.fileId, this.center.x, this.center.y);
            } else {
                try {
                    AppStore.Instance.resetRegionSpectralProfileProgress(this.regionId);
                    await this.backendService.setRegion(this.fileId, this.regionId, this, isRequestingPreview);
                    console.log("Region updated");
                } catch (err) {
                    console.log(err);
                }
            }
        }
    };

    private throttledUpdateRegion = throttle(this.updateRegion, 100);
}
