import { action, computed, observable } from "mobx";
import { CARTA } from "carta-protobuf";
import { Colors } from "@blueprintjs/core";
import { Point2D } from "models";
import { BackendService } from "services";
import { minMax2D, midpoint2D, scale2D, simplePolygonTest, simplePolygonPointTest, toFixed } from "utilities";
import { FrameStore } from "stores";

export const CURSOR_REGION_ID = 0;
export const FOCUS_REGION_RATIO = 0.4;

export class RegionStore {
    @observable fileId: number;
    @observable regionId: number;
    @observable name: string;
    @observable color: string;
    @observable lineWidth: number;
    @observable dashLength: number;
    @observable regionType: CARTA.RegionType;
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

    private readonly backendService: BackendService;

    public static RegionTypeString(regionType: CARTA.RegionType): string {
        switch (regionType) {
            case CARTA.RegionType.POINT:
                return "Point";
            case CARTA.RegionType.RECTANGLE:
                return "Rectangle";
            case CARTA.RegionType.ELLIPSE:
                return "Ellipse";
            case CARTA.RegionType.POLYGON:
                return "Polygon";
            default:
                return "Not Implemented";
        }
    }

    static readonly AVAILABLE_REGION_TYPES = new Map<CARTA.RegionType, string>([
        [CARTA.RegionType.POINT, "Point"],
        [CARTA.RegionType.RECTANGLE, "Rectangle"],
        [CARTA.RegionType.ELLIPSE, "Ellipse"],
        [CARTA.RegionType.POLYGON, "Polygon"]
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
                return this.controlPoints[0];
            case CARTA.RegionType.POLYGON:
                const bounds = minMax2D(this.controlPoints);
                return midpoint2D(bounds.minPoint, bounds.maxPoint);
            default:
                return {x: 0, y: 0};
        }
    }

    @computed get boundingBox(): Point2D {
        if (!this.isValid) {
            return {x: 0, y: 0};
        }
        switch (this.regionType) {
            case CARTA.RegionType.RECTANGLE:
                return this.controlPoints[1];
            case CARTA.RegionType.ELLIPSE:
                return scale2D(this.controlPoints[1], 2);
            case CARTA.RegionType.POLYGON:
                const boundingBox = minMax2D(this.controlPoints);
                return {x: boundingBox.maxPoint.x - boundingBox.minPoint.x, y: boundingBox.maxPoint.y - boundingBox.minPoint.y};
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
                return this.controlPoints.length === 2 && this.controlPoints[1].x > 0 && this.controlPoints[1].y > 0;
            case CARTA.RegionType.POLYGON:
                return this.controlPoints.length >= 1;
            default:
                return false;
        }
    }

    @computed get nameString(): string {
        if (this.regionId === CURSOR_REGION_ID) {
            return "Cursor";
        } else if (this.name) {
            return this.name;
        } else {
            return `Region ${this.regionId}`;
        }
    }

    @computed get regionProperties(): string {
        const point = this.controlPoints[0];
        const center = isFinite(point.x) && isFinite(point.y) ? `${toFixed(point.x, 1)}pix, ${toFixed(point.y, 1)}pix` : "Invalid";

        switch (this.regionType) {
            case CARTA.RegionType.POINT:
                return `Point (pixel) [${center}]`;
            case CARTA.RegionType.RECTANGLE:
                return `rotbox[[${center}], ` +
                    `[${toFixed(this.controlPoints[1].x, 1)}pix, ${toFixed(this.controlPoints[1].y, 1)}pix], ` +
                    `${toFixed(this.rotation, 1)}deg]`;
            case CARTA.RegionType.ELLIPSE:
                return `ellipse[[${center}], ` +
                    `[${toFixed(this.controlPoints[1].x, 1)}pix, ${toFixed(this.controlPoints[1].y, 1)}pix], ` +
                    `${toFixed(this.rotation, 1)}deg]`;
            case CARTA.RegionType.POLYGON:
                // TODO: Region properties
                const bounds = minMax2D(this.controlPoints);
                return `polygon[[${center}], ` +
                    `[${toFixed(bounds.maxPoint.x, 1)}pix, ${toFixed(bounds.maxPoint.y, 1)}pix], ` +
                    `${toFixed(this.rotation, 1)}deg]`;
            default:
                return "Not Implemented";
        }
    }

    constructor(backendService: BackendService, fileId: number, activeFrame: FrameStore,  controlPoints: Point2D[], regionType: CARTA.RegionType, regionId: number = -1,
                color: string = Colors.TURQUOISE5, lineWidth: number = 2, dashLength: number = 0, rotation: number = 0, name: string = "") {
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
        this.simplePolygonTest();
    }

    @action setRegionId = (id: number) => {
        this.regionId = id;
    };

    @action setControlPoint = (index: number, p: Point2D, skipUpdate = false) => {
        if (index >= 0 && index < this.controlPoints.length) {
            this.controlPoints[index] = p;
            if (!this.editing && !skipUpdate) {
                this.updateRegion();
            }
            if (this.regionType === CARTA.RegionType.POLYGON) {
                this.simplePolygonTest(index);
            }
        }
    };

    @action setControlPoints = (points: Point2D[], skipUpdate = false, shapeChanged = true) => {
        this.controlPoints = points;
        if (shapeChanged && this.regionType === CARTA.RegionType.POLYGON) {
            this.simplePolygonTest();
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
        this.rotation = (angle + 360) % 360;
        if (!this.editing && !skipUpdate) {
            this.updateRegion();
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

    @action endCreating = () => {
        this.creating = false;
        this.editing = false;
        if (this.regionType !== CARTA.RegionType.POINT) {
            this.backendService.setRegion(this.fileId, -1, this).subscribe(ack => {
                if (ack.success) {
                    console.log(`Updating regionID from ${this.regionId} to ${ack.regionId}`);
                    this.setRegionId(ack.regionId);
                }
            });
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

    // Update the region with the backend
    private updateRegion = () => {
        if (this.isValid) {
            if (this.regionId === CURSOR_REGION_ID && this.regionType === CARTA.RegionType.POINT) {
                this.backendService.setCursor(this.fileId, this.controlPoints[0].x, this.controlPoints[0].y);
            } else {
                this.backendService.setRegion(this.fileId, this.regionId, this).subscribe(ack => {
                    if (ack.success) {
                        console.log(`Region updated`);
                    } else {
                        console.log(ack.message);
                    }
                });
            }
        }
    };
}