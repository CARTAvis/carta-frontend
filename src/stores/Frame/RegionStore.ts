import {action, computed, observable, makeObservable} from "mobx";
import {Colors, IconName} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import * as AST from "ast_wrapper";
import {Point2D} from "models";
import {BackendService} from "services";
import {add2D, getApproximateEllipsePoints, getApproximatePolygonPoints, isAstBadPoint, length2D, midpoint2D, minMax2D, rotate2D, scale2D, simplePolygonPointTest, simplePolygonTest, subtract2D, toFixed, transformPoint} from "utilities";
import {AppStore} from "stores";
import {FrameStore} from "stores/Frame";
import {CustomIconName} from "icons/CustomIcons";

export const CURSOR_REGION_ID = 0;
export const FOCUS_REGION_RATIO = 0.4;

const CENTER_POINT_INDEX = 0;
const SIZE_POINT_INDEX = 1;

export enum RegionCoordinate {
    Image = "Image",
    World = "World"
}

export class RegionStore {
    readonly fileId: number;
    @observable regionId: number;
    @observable name: string;
    @observable color: string;
    @observable lineWidth: number;
    @observable dashLength: number;
    @observable regionType: CARTA.RegionType;
    @observable coordinate: RegionCoordinate;
    // Shallow observable, since control point updates are atomic
    @observable.shallow controlPoints: Point2D[];
    @observable rotation: number;
    @observable editing: boolean;
    @observable creating: boolean;
    @observable locked: boolean;
    @observable isSimplePolygon: boolean;
    @observable activeFrame: FrameStore;

    static readonly MIN_LINE_WIDTH = 0.5;
    static readonly MAX_LINE_WIDTH = 10;
    static readonly MAX_DASH_LENGTH = 50;
    static readonly TARGET_VERTEX_COUNT = 200;

    private readonly backendService: BackendService;
    private readonly regionApproximationMap: Map<AST.FrameSet, Point2D[]>;
    public modifiedTimestamp: number;

    public static RegionTypeString(regionType: CARTA.RegionType): string {
        switch (regionType) {
            case CARTA.RegionType.POINT:
                return "Point";
            case CARTA.RegionType.LINE:
                return "Line";
            case CARTA.RegionType.RECTANGLE:
                return "Rectangle";
            case CARTA.RegionType.ELLIPSE:
                return "Ellipse";
            case CARTA.RegionType.POLYGON:
                return "Polygon";
            case CARTA.RegionType.POLYLINE:
                return "Polyline";
            default:
                return "Not Implemented";
        }
    }

    public static IsRegionCustomIcon(regionType: CARTA.RegionType): boolean {
        switch (regionType) {
            case CARTA.RegionType.LINE:
            case CARTA.RegionType.POLYLINE:
                return true;
            default:
                return false;
        }
    }

    public static RegionIconString(regionType: CARTA.RegionType): IconName | CustomIconName {
        switch (regionType) {
            case CARTA.RegionType.POINT:
                return "symbol-square";
            case CARTA.RegionType.LINE:
                return "line";
            case CARTA.RegionType.RECTANGLE:
                return "square";
            case CARTA.RegionType.ELLIPSE:
                return "circle";
            case CARTA.RegionType.POLYGON:
                return "polygon-filter";
            case CARTA.RegionType.POLYLINE:
                return "polyline";
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
            case CARTA.RegionType.RECTANGLE:
            case CARTA.RegionType.ELLIPSE:
                return this.controlPoints[CENTER_POINT_INDEX];
            case CARTA.RegionType.POLYGON:
            case CARTA.RegionType.POLYLINE:
                const bounds = minMax2D(this.controlPoints);
                return midpoint2D(bounds.minPoint, bounds.maxPoint);
            case CARTA.RegionType.LINE:
                return midpoint2D(this.controlPoints[0], this.controlPoints[1]);
            default:
                return {x: 0, y: 0};
        }
    }

    @computed get size(): Point2D {
        switch (this.regionType) {
            case CARTA.RegionType.RECTANGLE:
            case CARTA.RegionType.ELLIPSE:
                return this.controlPoints[SIZE_POINT_INDEX];
            case CARTA.RegionType.POLYGON:
            case CARTA.RegionType.POLYLINE:
                return this.boundingBox;
            case CARTA.RegionType.LINE:
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
                return this.size;
            case CARTA.RegionType.ELLIPSE:
                return scale2D(this.size, 2);
            case CARTA.RegionType.POLYGON:
            case CARTA.RegionType.POLYLINE:
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
                return this.controlPoints.length === 1;
            case CARTA.RegionType.RECTANGLE:
            case CARTA.RegionType.ELLIPSE:
                return this.controlPoints.length === 2 && this.size.x > 0 && this.size.y > 0;
            case CARTA.RegionType.POLYGON:
            case CARTA.RegionType.POLYLINE:
                return this.controlPoints.length >= 1;
            case CARTA.RegionType.LINE:
                return this.controlPoints.length === 1 || this.controlPoints.length === 2;
            default:
                return false;
        }
    }

    @computed get nameString(): string {
        if (this.regionId === CURSOR_REGION_ID) {
            return "Cursor";
        } else if (this.name && this.name !== "") {
            return this.name;
        } else {
            // temporary region id < 0, use "..." for representation
            return `Region ${this.regionId > CURSOR_REGION_ID ? this.regionId : "..."}`;
        }
    }

    @computed get regionProperties(): string {
        const point = this.center;
        const center = isFinite(point.x) && isFinite(point.y) ? `${toFixed(point.x, 6)}pix, ${toFixed(point.y, 6)}pix` : "Invalid";

        switch (this.regionType) {
            case CARTA.RegionType.POINT:
                return `Point (pixel) [${center}]`;
            case CARTA.RegionType.RECTANGLE:
                return `rotbox[[${center}], [${toFixed(this.size.x, 6)}pix, ${toFixed(this.size.y, 6)}pix], ${toFixed(this.rotation, 6)}deg]`;
            case CARTA.RegionType.ELLIPSE:
                return `ellipse[[${center}], [${toFixed(this.size.x, 6)}pix, ${toFixed(this.size.y, 6)}pix], ${toFixed(this.rotation, 6)}deg]`;
            case CARTA.RegionType.POLYGON:
                let polygonProperties = "poly[";
                this.controlPoints.forEach((point, index) => {
                    polygonProperties += isFinite(point.x) && isFinite(point.y) ? `[${toFixed(point.x, 6)}pix, ${toFixed(point.y, 6)}pix]` : "[Invalid]";
                    polygonProperties += index !== this.controlPoints.length - 1 ? ", " : "]";
                });
                return polygonProperties;
            default:
                return "Not Implemented";
        }
    }

    public getRegionApproximation(astTransform: AST.FrameSet): Point2D[] {
        let approximatePoints = this.regionApproximationMap.get(astTransform);
        if (!approximatePoints) {
            if (this.regionType === CARTA.RegionType.POINT) {
                approximatePoints = [transformPoint(astTransform, this.center, false)];
            }
            if (this.regionType === CARTA.RegionType.ELLIPSE) {
                approximatePoints = getApproximateEllipsePoints(astTransform, this.center, this.size.y, this.size.x, this.rotation, RegionStore.TARGET_VERTEX_COUNT);
            } else if (this.regionType === CARTA.RegionType.RECTANGLE) {
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
            this.coordinate = RegionCoordinate.World;
        } else {
            this.coordinate = RegionCoordinate.Image;
        }
        this.isSimplePolygon = true;

        // Force rotation to zero if image pixes are non-square
        if (!this.activeFrame?.hasSquarePixels) {
            this.rotation = 0;
        }

        this.regionApproximationMap = new Map<number, Point2D[]>();
        if (this.regionType === CARTA.RegionType.POLYGON) {
            this.simplePolygonTest();
        }
        if (this.regionType === CARTA.RegionType.LINE && controlPoints.length === 2) {
            this.rotation = this.controlPoints.length === 2 ? this.getLineAngle(this.controlPoints[0], this.controlPoints[1]) : 0;
        }
        this.modifiedTimestamp = performance.now();
    }

    @action setRegionId = (id: number) => {
        this.regionId = id;
    };

    @action setCenter = (p: Point2D, skipUpdate = false) => {
        if (this.regionType === CARTA.RegionType.LINE) {
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
        if (this.regionType === CARTA.RegionType.LINE) {
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
            }
            if (this.regionType === CARTA.RegionType.POLYGON) {
                this.simplePolygonTest(index);
            }

            if (this.regionType === CARTA.RegionType.LINE) {
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
        if (shapeChanged && this.regionType === CARTA.RegionType.POLYGON) {
            this.simplePolygonTest();
        }

        if (this.regionType === CARTA.RegionType.LINE) {
            this.rotation = points.length === 2 ? this.getLineAngle(points[0], points[1]) : 0;
        }

        if (!this.editing && !skipUpdate) {
            this.updateRegion();
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
        if (this.regionType === CARTA.RegionType.LINE) {
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
    };

    @action setLineWidth = (lineWidth: number) => {
        this.lineWidth = lineWidth;
    };

    @action setDashLength = (dashLength: number) => {
        this.dashLength = dashLength;
    };

    @action beginCreating = () => {
        this.creating = true;
        this.editing = true;
    };

    @action endCreating = async () => {
        this.creating = false;
        this.editing = false;
        if (this.regionType !== CARTA.RegionType.POINT) {
            try {
                const ack = await this.backendService.setRegion(this.fileId, -1, this);
                console.log(`Updating regionID from ${this.regionId} to ${ack.regionId}`);
                this.setRegionId(ack.regionId);
            } catch (err) {
                console.log(err);
            }
        }
    };

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

    @action setCoordinate = (coordinate: RegionCoordinate) => {
        if (coordinate) {
            this.coordinate = coordinate;
        }
    };

    // Update the region with the backend
    private updateRegion = async () => {
        if (this.isValid) {
            if (this.regionId === CURSOR_REGION_ID) {
                AppStore.Instance.resetCursorRegionSpectralProfileProgress(this.fileId);
                this.backendService.setCursor(this.fileId, this.center.x, this.center.y);
            } else {
                try {
                    AppStore.Instance.resetRegionSpectralProfileProgress(this.regionId);
                    await this.backendService.setRegion(this.fileId, this.regionId, this);
                    console.log("Region updated");
                } catch (err) {
                    console.log(err);
                }
            }
        }
    };
}
