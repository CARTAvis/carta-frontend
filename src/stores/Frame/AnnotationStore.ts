import {action, observable, makeObservable} from "mobx";
import {Colors} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import * as AST from "ast_wrapper";
import {Point2D} from "models";
import {BackendService} from "services";
// import {AppStore} from "stores";
import {FrameStore} from "stores/Frame";
// import {CustomIconName} from "icons/CustomIcons";
import {getApproximatePolygonPoints} from "utilities";
import {RegionStore} from "./RegionStore";

export class TextAnnotationStore extends RegionStore {
    @observable text: string = "Double click to edit text";

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
        super(backendService, fileId, activeFrame, controlPoints, regionType, regionId, color, lineWidth, dashLength, rotation, name);
        makeObservable(this);
    }

    @action setText = (text: string) => {
        this.text = text;
    };
}

export class CompassAnnotationStore extends RegionStore {
    @observable northLabel: string = "test north";
    @observable eastLabel: string = "test east";
    @observable isNorthArrowhead: boolean = true;
    @observable isEastArrowhead: boolean = true;

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
        super(backendService, fileId, activeFrame, controlPoints, regionType, regionId, color, lineWidth, dashLength, rotation, name);
        makeObservable(this);
    }

    @action setLabel = (label: string, isNorth: boolean) => {
        if (isNorth) {
            this.northLabel = label;
        } else {
            this.eastLabel = label;
        }
    };

    public getRegionApproximation(astTransform: AST.FrameSet): any {
        let northApproximatePoints = this.regionApproximationMap.get(astTransform);
        let eastApproximatePoints = this.regionApproximationMap.get(astTransform);
        const startPoint = {x: Math.max(this.controlPoints[0].x, this.controlPoints[1].x), y: Math.min(this.controlPoints[0].y, this.controlPoints[1].y)};
        // const northEndPoint = {x: this.controlPoints[0].x, y: this.controlPoints[1].y}
        // const eastEndPoint = {x: this.controlPoints[1].x, y: this.controlPoints[0].y}
        const northEndPoint = {x: startPoint.x, y: Math.max(this.controlPoints[0].y, this.controlPoints[1].y)};
        const eastEndPoint = {x: Math.min(this.controlPoints[0].x, this.controlPoints[1].x), y: startPoint.y};
        const northArrowPoints = [startPoint, northEndPoint];
        const eastArrowPoints = [startPoint, eastEndPoint];
        // const northArrowPoints = [startPoint, {x: this.controlPoints[0].x, y: this.controlPoints[1].y}]
        // const eastArrowPoints = [startPoint, {x: this.controlPoints[1].x, y: this.controlPoints[0].y}]
        // const northArrowPoints = [{...this.endPoints[0]}, {x: this.endPoints[0].x, y: this.endPoints[1].y}]
        // const eastArrowPoints = [{...this.endPoints[0]}, {x: this.endPoints[1].x, y: this.endPoints[0].y}]
        if (!northApproximatePoints && !eastApproximatePoints) {
            northApproximatePoints = getApproximatePolygonPoints(astTransform, northArrowPoints, RegionStore.TARGET_VERTEX_COUNT, false);
            eastApproximatePoints = getApproximatePolygonPoints(astTransform, eastArrowPoints, RegionStore.TARGET_VERTEX_COUNT, false);

            // this.regionApproximationMap.set(astTransform, northApproximatePoints);
            // this.regionApproximationMap.set(astTransform, eastApproximatePoints);
        }
        return {northApproximatePoints, eastApproximatePoints};
    }
}

export class RulerAnnotationStore extends RegionStore {
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
        super(backendService, fileId, activeFrame, controlPoints, regionType, regionId, color, lineWidth, dashLength, rotation, name);
        makeObservable(this);
    }

    public getRegionApproximation(astTransform: AST.FrameSet): any {
        let xApproximatePoints = this.regionApproximationMap.get(astTransform);
        let yApproximatePoints = this.regionApproximationMap.get(astTransform);
        let hypotenuseApproximatePoints = this.regionApproximationMap.get(astTransform);
        const startPoint = {x: this.controlPoints[1].x, y: this.controlPoints[0].y};
        const xEndPoint = {x: this.controlPoints[0].x, y: this.controlPoints[0].y};
        const yEndPoint = {x: this.controlPoints[1].x, y: this.controlPoints[1].y};
        // const northEndPoint = {x: startPoint.x, y: Math.max(this.controlPoints[0].y, this.controlPoints[1].y)}
        // const eastEndPoint = {x: Math.min(this.controlPoints[0].x, this.controlPoints[1].x), y: startPoint.y}
        const xArrowPoints = [startPoint, xEndPoint];
        const yArrowPoints = [startPoint, yEndPoint];
        const hypotenuseArrowPoints = [xEndPoint, yEndPoint];
        // const northArrowPoints = [startPoint, {x: this.controlPoints[0].x, y: this.controlPoints[1].y}]
        // const eastArrowPoints = [startPoint, {x: this.controlPoints[1].x, y: this.controlPoints[0].y}]
        // const northArrowPoints = [{...this.endPoints[0]}, {x: this.endPoints[0].x, y: this.endPoints[1].y}]
        // const eastArrowPoints = [{...this.endPoints[0]}, {x: this.endPoints[1].x, y: this.endPoints[0].y}]
        if (!yApproximatePoints && !xApproximatePoints) {
            xApproximatePoints = getApproximatePolygonPoints(astTransform, xArrowPoints, RegionStore.TARGET_VERTEX_COUNT, false);
            yApproximatePoints = getApproximatePolygonPoints(astTransform, yArrowPoints, RegionStore.TARGET_VERTEX_COUNT, false);
            hypotenuseApproximatePoints = getApproximatePolygonPoints(astTransform, hypotenuseArrowPoints, RegionStore.TARGET_VERTEX_COUNT, false);

            // this.regionApproximationMap.set(astTransform, northApproximatePoints);
            // this.regionApproximationMap.set(astTransform, eastApproximatePoints);
        }
        return {xApproximatePoints, yApproximatePoints, hypotenuseApproximatePoints};
    }
}
