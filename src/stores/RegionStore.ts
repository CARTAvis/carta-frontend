import {action, computed, observable} from "mobx";
import {CARTA} from "carta-protobuf";
import {Point2D} from "models";
import {BackendService} from "../services";
import {Colors} from "@blueprintjs/core";

export class RegionStore {
    @observable fileId: number;
    @observable regionId: number;
    @observable name: string;
    @observable color: string;
    @observable lineWidth: number;
    @observable dashLength: number;
    @observable regionType: CARTA.RegionType;
    @observable controlPoints: Point2D[];
    @observable rotation: number;
    @observable editing: boolean;
    @observable creating: boolean;

    private readonly backendService: BackendService;

    public static RegionTypeString(regionType: CARTA.RegionType): string {
        switch (regionType) {
            case CARTA.RegionType.POINT:
                return "Point";
            case CARTA.RegionType.RECTANGLE:
                return "Rectangle";
            case CARTA.RegionType.ELLIPSE:
                return "Ellipse";
            default:
                return "Not Implemented";
        }
    }

    @computed get isTemporary() {
        return this.regionId < 0;
    }

    @computed get boundingBoxArea(): number {
        if (!this.isValid) {
            return 0;
        }
        switch (this.regionType) {
            case CARTA.RegionType.RECTANGLE:
                return this.controlPoints[1].x * this.controlPoints[1].y;
            case CARTA.RegionType.ELLIPSE:
                return 4 * this.controlPoints[1].x * this.controlPoints[1].y;
            default:
                return 0;
        }
    }

    @computed get isClosedRegion() {
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

    @computed get isValid() {
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
            default:
                return false;
        }
    }

    @computed get nameString() {
        if (this.regionId === 0) {
            return "Cursor";
        } else if (this.name) {
            return this.name;
        } else {
            return `Region ${this.regionId}`;
        }
    }

    constructor(backendService: BackendService, fileId: number, controlPoints: Point2D[], regionType: CARTA.RegionType, regionId: number = -1, rotation: number = 0,
                name: string = "", color: string = Colors.TURQUOISE5, lineWidth: number = 2, dashLength: number = 0) {
        this.fileId = fileId;
        this.controlPoints = controlPoints;
        this.regionType = regionType;
        this.regionId = regionId;
        this.name = name;
        this.color = color;
        this.lineWidth = lineWidth;
        this.dashLength = dashLength;
        this.rotation = rotation;
        this.backendService = backendService;
    }

    @action setRegionId = (id: number) => {
        this.regionId = id;
    };

    @action setControlPoint = (index: number, p: Point2D) => {
        if (index >= 0 && index < this.controlPoints.length) {
            this.controlPoints[index] = p;
            if (!this.editing) {
                this.updateRegion();
            }
        }
    };

    @action setControlPoints = (points: Point2D[]) => {
        this.controlPoints = points;
        if (!this.editing) {
            this.updateRegion();
        }
    };

    @action setRotation = (angle: number) => {
        this.rotation = (angle + 360) % 360;
        if (!this.editing) {
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
        this.backendService.setRegion(this.fileId, -1, this).subscribe(ack => {
            if (ack.success) {
                console.log(`Updating regionID from ${this.regionId} to ${ack.regionId}`);
                this.setRegionId(ack.regionId);
            }
        });
    };

    @action beginEditing = () => {
        this.editing = true;
    };

    @action endEditing = () => {
        this.editing = false;
        this.updateRegion();
    };

    // Update the region with the backend
    private updateRegion = () => {
        if (this.regionId === 0 && this.regionType === CARTA.RegionType.POINT && this.isValid) {
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
    };
}