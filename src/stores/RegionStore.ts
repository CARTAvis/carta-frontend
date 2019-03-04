import {action, computed, observable} from "mobx";
import {CARTA} from "carta-protobuf";
import {Point2D} from "models";
import {BackendService} from "../services";

export class RegionStore {
    @observable fileId: number;
    @observable regionId: number;
    @observable regionType: CARTA.RegionType;
    @observable channelMin: number;
    @observable channelMax: number;
    @observable stokesValues: number[];
    @observable controlPoints: Point2D[];
    @observable rotation: number;
    @observable editing: boolean;
    @observable creating: boolean;

    private readonly backendService: BackendService;

    @computed get isTemporary() {
        return this.regionId < 0;
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

    constructor(backendService: BackendService, fileId: number, controlPoints: Point2D[], regionType: CARTA.RegionType,
                regionId: number = -1, rotation: number = 0, channelMin: number = -1, channelMax: number = -1, stokesValues: number[] = []) {
        this.fileId = fileId;
        this.controlPoints = controlPoints;
        this.regionType = regionType;
        this.regionId = regionId;
        this.channelMin = channelMin;
        this.channelMax = channelMax;
        this.stokesValues = stokesValues;
        this.rotation = rotation;
        this.backendService = backendService;
    }

    @action setRegionId = (id: number) => {
        this.regionId = id;
    };

    @action setControlPoint = (index: number, p: Point2D) => {
        if (index >= 0 && index < this.controlPoints.length) {
            this.controlPoints[index] = p;
        }
    };

    @action setControlPoints = (points: Point2D[]) => {
        this.controlPoints = points;
        if (!this.editing) {
            this.updateRegion();
        }
    };

    @action setRotation = (angle: number) => {
        this.rotation = angle;
        if (!this.editing) {
            this.updateRegion();
        }
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
        this.backendService.setRegion(this.fileId, this.regionId, this).subscribe(ack => {
            if (ack.success) {
                console.log(`Region updated`);
            } else {
                console.log(ack.message);
            }
        });
    };
}