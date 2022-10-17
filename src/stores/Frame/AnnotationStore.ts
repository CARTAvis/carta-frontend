import {action, observable, makeObservable} from "mobx";
import {Colors} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import * as AST from "ast_wrapper";
import {Point2D} from "models";
import {BackendService} from "services";
import {FrameStore} from "stores/Frame";
import {RegionStore} from "./RegionStore";
import {transformPoint} from "utilities";

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
        console.log("length change", length);

        if (length < 0) {
            this.length = 0;
        }

        this.length = length;
    };

    public getRegionApproximation(astTransform: AST.FrameSet): any {
        let northApproximatePoints;
        let eastApproximatePoints;

        const startPoint = {x: this.controlPoints[0].x + this.length / 2, y: this.controlPoints[0].y - this.length / 2};
        const northEndPoint = {x: startPoint.x, y: startPoint.y + this.length};
        const eastEndPoint = {x: startPoint.x - this.length, y: startPoint.y};

        const xIn = new Float64Array(2);
        const yIn = new Float64Array(2);
        xIn[0] = northEndPoint.x;
        xIn[1] = eastEndPoint.x;
        yIn[0] = northEndPoint.y;
        yIn[1] = eastEndPoint.y;
        const transformed = AST.transformPointArrays(astTransform, xIn, yIn);
        const originPoints = {x: transformed.x[0], y: transformed.y[1]};

        //index 0 is North, index 1 is East
        const originToNorthX = new Float64Array(2);
        originToNorthX[0] = originPoints.x;
        originToNorthX[1] = transformed.x[0];
        const originToNorthY = new Float64Array(2);
        originToNorthY[0] = originPoints.y;
        originToNorthY[1] = transformed.y[0];
        const originToEastX = new Float64Array(2);
        originToEastX[0] = originPoints.x;
        originToEastX[1] = transformed.x[1];
        const originToEastY = new Float64Array(2);
        originToEastY[0] = originPoints.y;
        originToEastY[1] = transformed.y[1];
        northApproximatePoints = AST.transformPointList(astTransform, originToNorthX, originToNorthY);
        eastApproximatePoints = AST.transformPointList(astTransform, originToEastX, originToEastY);

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

    public getRegionApproximation(astTransform: AST.FrameSet, spatiallyMatched?: boolean): any {
        let xApproximatePoints;
        let yApproximatePoints;
        let hypotenuseApproximatePoints;

        const xIn = new Float64Array(2);
        const yIn = new Float64Array(2);

        // const imagePointStart = this.controlPoints[0];
        // const imagePointFinish = this.controlPoints[1];
        console.log(this.activeFrame.filename);
        const imagePointStart = spatiallyMatched ? transformPoint(astTransform, this.controlPoints[0], false) : this.controlPoints[0];
        const imagePointFinish = spatiallyMatched ? transformPoint(astTransform, this.controlPoints[1], false) : this.controlPoints[1];
        // const imagePointStart = this.activeFrame.spatialReference ? transformPoint(astTransform, this.controlPoints[0], false) : this.controlPoints[0];
        // const imagePointFinish = this.activeFrame.spatialReference ? transformPoint(astTransform, this.controlPoints[1], false) : this.controlPoints[1];
        xIn[0] = imagePointStart.x;
        xIn[1] = imagePointFinish.x;
        yIn[0] = imagePointStart.y;
        yIn[1] = imagePointFinish.y;

        const transformed = AST.transformPointArrays(astTransform, xIn, yIn);
        const startX = transformed.x[0];
        const finishX = transformed.x[1];
        const cornerX = transformed.x[1];
        const startY = transformed.y[0];
        const finishY = transformed.y[1];
        const cornerY = transformed.y[0];

        const finishToCornerX = new Float64Array(2);
        finishToCornerX[0] = finishX;
        finishToCornerX[1] = cornerX;
        const finishToCornerY = new Float64Array(2);
        finishToCornerY[0] = finishY;
        finishToCornerY[1] = cornerY;

        const cornerToStartX = new Float64Array(2);
        cornerToStartX[0] = cornerX;
        cornerToStartX[1] = startX;
        const cornerToStartY = new Float64Array(2);
        cornerToStartY[0] = cornerY;
        cornerToStartY[1] = startY;

        xApproximatePoints = AST.transformPointList(astTransform, cornerToStartX, cornerToStartY);
        yApproximatePoints = AST.transformPointList(astTransform, finishToCornerX, finishToCornerY);
        hypotenuseApproximatePoints = AST.transformPointList(astTransform, transformed.x, transformed.y);

        return {xApproximatePoints, yApproximatePoints, hypotenuseApproximatePoints};
    }
}
