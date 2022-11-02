import {action, observable, makeObservable} from "mobx";
import {Colors} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import * as AST from "ast_wrapper";
import {Point2D} from "models";
import {BackendService} from "services";
import {FrameStore} from "stores/Frame";
import {POINTSHAPE, RegionStore} from "./RegionStore";
import {transformPoint} from "utilities";

export enum TextAnnotationPosition {
    UPPER_LEFT = "Upper Left",
    CENTER = "Center",
    UPPER_RIGHT = "Upper Right",
    LOWER_LEFT = "Lower Left",
    LOWER_RIGHT = "Lower Right",
    TOP = "Top",
    BOTTOM = "Bottom",
    LEFT = "Left",
    RIGHT = "Right"
}

export class PointAnnotationStore extends RegionStore {
    @observable pointShape: POINTSHAPE;
    @observable pointWidth: number;

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
        pointShape: POINTSHAPE = POINTSHAPE.SQUARE,
        pointWidth: number = 6,
        rotation: number = 0,
        name: string = ""
    ) {
        super(backendService, fileId, activeFrame, controlPoints, regionType, regionId, color, lineWidth, dashLength, rotation, name);
        makeObservable(this);
        this.pointShape = pointShape || POINTSHAPE.SQUARE;
        this.pointWidth = pointWidth || 6;
    }

    @action setPointShape = (pointShape: string) => {
        switch (pointShape) {
            case "SQUARE":
                this.pointShape = POINTSHAPE.SQUARE;
                break;
            case "BOX":
                this.pointShape = POINTSHAPE.BOX;
                break;
            case "CIRCLE":
                this.pointShape = POINTSHAPE.CIRCLE;
                break;
            case "CIRCLE_LINED":
                this.pointShape = POINTSHAPE.CIRCLE_LINED;
                break;
            case "DIAMOND":
                this.pointShape = POINTSHAPE.DIAMOND;
                break;
            case "DIAMOND_LINED":
                this.pointShape = POINTSHAPE.DIAMOND_LINED;
                break;
            case "CROSS":
                this.pointShape = POINTSHAPE.CROSS;
                break;
            case "X":
                this.pointShape = POINTSHAPE.X;
                break;
            default:
                this.pointShape = POINTSHAPE.SQUARE;
        }
    };

    @action setPointWidth = (width: number) => {
        this.pointWidth = width;
    };
}

export class TextAnnotationStore extends RegionStore {
    @observable text: string = "Double click to edit text";
    @observable fontSize: number = 20;
    @observable position: TextAnnotationPosition = TextAnnotationPosition.UPPER_LEFT;

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

    @action setPosition = (position: TextAnnotationPosition) => {
        this.position = position;
    };
}

export class VectorAnnotationStore extends RegionStore {
    @observable pointerWidth: number = 20;
    @observable pointerLength: number = 20;
    @observable lengthScale: number = 1;

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

    @action setPointerWidth = (pointerWidth: number) => {
        this.pointerWidth = pointerWidth;
    };

    @action setPointerLength = (pointerLength: number) => {
        this.pointerLength = pointerLength;
    };

    @action setLengthScale = (lengthScale: number) => {
        this.lengthScale = lengthScale;
    };
}

export class CompassAnnotationStore extends RegionStore {
    @observable length: number = 100;
    @observable northLabel: string = "N";
    @observable eastLabel: string = "E";
    @observable isNorthArrowhead: boolean = true;
    @observable isEastArrowhead: boolean = true;
    @observable fontSize: number = 20;
    @observable pointerWidth: number = 10;
    @observable pointerLength: number = 10;
    @observable lengthScale: number = 1;
    @observable northTextOffset: Point2D = {x: 0, y: 0};
    @observable eastTextOffset: Point2D = {x: 0, y: 0};

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
        // this.setLength(Math.max(this.activeFrame.frameInfo.fileInfoExtended.width, this.activeFrame.frameInfo.fileInfoExtended.height) * 0.1);
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

    @action setLengthScale = (lengthScale: number) => {
        this.lengthScale = lengthScale;
    };

    @action setPointerWidth = (width: number) => {
        this.pointerWidth = width;
    };

    @action setPointerLength = (length: number) => {
        this.pointerLength = length;
    };

    @action setLength = (length: number) => {
        this.length = Math.abs(length);
    };

    @action setNorthTextOffset = (offset: number, isX: boolean) => {
        if (isX) {
            this.northTextOffset = {...this.northTextOffset, x: offset};
        } else {
            this.northTextOffset = {...this.northTextOffset, y: offset};
        }
    };

    @action setEastTextOffset = (offset: number, isX: boolean) => {
        if (isX) {
            this.eastTextOffset = {...this.eastTextOffset, x: offset};
        } else {
            this.eastTextOffset = {...this.eastTextOffset, y: offset};
        }
    };

    public getRegionApproximation(astTransform: AST.FrameSet, spatiallyMatched?: boolean, spatialTransform?: AST.FrameSet): any {
        const originPoint = spatiallyMatched ? transformPoint(spatialTransform, this.controlPoints[0], false) : this.controlPoints[0];
        const transformed = AST.transformPoint(astTransform, originPoint.x, originPoint.y);

        const delta1 = this.activeFrame.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.includes("CDELT1"));
        const delta2 = this.activeFrame.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.includes("CDELT2"));
        const frameView = this.activeFrame.requiredFrameView;
        const top = frameView.yMax;
        const bottom = frameView.yMin;
        const left = frameView.xMin;
        const right = frameView.xMax;
        const width = right - left;
        const height = top - bottom;
        const angularWidth = Math.abs((delta1.numericValue * Math.PI * width) / 180);
        const angularHeight = Math.abs((delta2.numericValue * Math.PI * height) / 180);

        const northApproximatePoints = AST.transformAxPointList(astTransform, 2, transformed.x, transformed.y, delta1 ? angularWidth : 6.18);
        const eastApproximatePoints = AST.transformAxPointList(astTransform, 1, transformed.x, transformed.y, delta2 ? angularHeight : 6.18);
        // const northApproximatePoints = AST.transformAxPointList(astTransform, 2, transformed.x, transformed.y, delta1 ? Math.abs((delta1?.numericValue * Math.PI * this.activeFrame.frameInfo.fileInfoExtended.width) / 180) : 6.18);
        // const eastApproximatePoints = AST.transformAxPointList(astTransform, 1, transformed.x, transformed.y, delta2 ? Math.abs((delta2?.numericValue * Math.PI * this.activeFrame.frameInfo.fileInfoExtended.height) / 180) : 6.18);

        return {northApproximatePoints, eastApproximatePoints};
    }
}

export class RulerAnnotationStore extends RegionStore {
    @observable fontSize: number = 20;
    @observable auxiliaryLineVisible: boolean = false;
    @observable auxiliaryLineDashLength: number = 0;
    @observable textOffset: Point2D = {x: 0, y: 0};

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

    @action setAuxiliaryLineVisible = (isVisible: boolean) => {
        this.auxiliaryLineVisible = isVisible;
    };

    @action setAuxiliaryLineDashLength = (length: number) => {
        this.auxiliaryLineDashLength = length;
    };

    @action setTextOffset = (offset: number, isX: boolean) => {
        if (isX) {
            this.textOffset = {...this.textOffset, x: offset};
        } else {
            this.textOffset = {...this.textOffset, y: offset};
        }
    };

    public getRegionApproximation(astTransform: AST.FrameSet, spatiallyMatched?: boolean): any {
        let xApproximatePoints;
        let yApproximatePoints;
        let hypotenuseApproximatePoints;

        const xIn = new Float64Array(2);
        const yIn = new Float64Array(2);

        const imagePointStart = spatiallyMatched ? transformPoint(astTransform, this.controlPoints[0], false) : this.controlPoints[0];
        const imagePointFinish = spatiallyMatched ? transformPoint(astTransform, this.controlPoints[1], false) : this.controlPoints[1];
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
