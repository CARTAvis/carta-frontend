import {action, observable, makeObservable} from "mobx";
import {Colors} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import * as AST from "ast_wrapper";
import {Point2D} from "models";
import {BackendService} from "services";
import {FrameStore} from "stores/Frame";
import {RegionStore} from "./RegionStore";

export class TextAnnotationStore extends RegionStore {
    @observable text: string = "Double click to edit text";
    @observable fontSize: number = 10;

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

    @action setFontSize = (fontSize: number) => {
        this.fontSize = fontSize;
    };
}

export class CompassAnnotationStore extends RegionStore {
    @observable length: number = 10;
    @observable northLabel: string = "North";
    @observable eastLabel: string = "East";
    @observable isNorthArrowhead: boolean = true;
    @observable isEastArrowhead: boolean = true;
    @observable fontSize: number = 20;

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

    @action setFontSize = (fontSize: number) => {
        this.fontSize = fontSize;
    };

    @action setLength = (length: number) => {
        this.length = length;
    };

    public getRegionApproximation(astTransform: AST.FrameSet): any {
        let northApproximatePoints = this.regionApproximationMap.get(astTransform);
        let eastApproximatePoints = this.regionApproximationMap.get(astTransform);

        if (!northApproximatePoints && !eastApproximatePoints) {
            const startPoint = {x: this.controlPoints[0].x + this.length / 2, y: this.controlPoints[0].y - this.length / 2};
            const northEndPoint = {x: startPoint.x, y: startPoint.y + this.length};
            const eastEndPoint = {x: startPoint.x - this.length, y: startPoint.y};
            const northArrowXIn = new Float64Array(2);
            northArrowXIn[0] = startPoint.x;
            northArrowXIn[1] = northEndPoint.x;
            const northArrowYIn = new Float64Array(2);
            northArrowYIn[0] = startPoint.y;
            northArrowYIn[1] = northEndPoint.y;
            const eastArrowXIn = new Float64Array(2);
            eastArrowXIn[0] = startPoint.x;
            eastArrowXIn[1] = eastEndPoint.x;
            const eastArrowYIn = new Float64Array(2);
            eastArrowYIn[0] = startPoint.y;
            eastArrowYIn[1] = eastEndPoint.y;
            northApproximatePoints = AST.transformPointList(astTransform, northArrowXIn, northArrowYIn);
            eastApproximatePoints = AST.transformPointList(astTransform, eastArrowXIn, eastArrowYIn);
        }
        return {northApproximatePoints, eastApproximatePoints};
    }
}

export class RulerAnnotationStore extends RegionStore {
    @observable fontSize: number = 10;

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

    @action setFontSize = (fontSize: number) => {
        this.fontSize = fontSize;
    };

    public getRegionApproximation(astTransform: AST.FrameSet): any {
        let xApproximatePoints;
        let yApproximatePoints;
        let hypotenuseApproximatePoints;

        const startPoint = {x: this.controlPoints[1].x, y: this.controlPoints[0].y};
        const xEndPoint = {x: this.controlPoints[0].x, y: this.controlPoints[0].y};
        const yEndPoint = {x: this.controlPoints[1].x, y: this.controlPoints[1].y};

        if (!yApproximatePoints && !xApproximatePoints) {
            const a1 = new Float64Array(2);
            a1[0] = startPoint.x;
            a1[1] = xEndPoint.x;
            const a2 = new Float64Array(2);
            a2[0] = startPoint.y;
            a2[1] = xEndPoint.y;
            const b1 = new Float64Array(2);
            b1[0] = startPoint.x;
            b1[1] = yEndPoint.x;
            const b2 = new Float64Array(2);
            b2[0] = startPoint.y;
            b2[1] = yEndPoint.y;
            const c1 = new Float64Array(2);
            c1[0] = xEndPoint.x;
            c1[1] = yEndPoint.x;
            const c2 = new Float64Array(2);
            c2[0] = xEndPoint.y;
            c2[1] = yEndPoint.y;

            xApproximatePoints = AST.transformPointList(astTransform, a1, a2);
            yApproximatePoints = AST.transformPointList(astTransform, b1, b2);
            hypotenuseApproximatePoints = AST.transformPointList(astTransform, c1, c2);
        }
        return {xApproximatePoints, yApproximatePoints, hypotenuseApproximatePoints};
    }
}
