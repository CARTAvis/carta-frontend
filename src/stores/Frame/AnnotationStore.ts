import {action, observable, makeObservable} from "mobx";
import {Colors} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import * as AST from "ast_wrapper";
import {Point2D} from "models";
import {BackendService} from "services";
import {FrameStore} from "stores/Frame";
import {RegionStore} from "./RegionStore";
import {transformPoint} from "utilities";

export enum TextAnnotationPosition {
    CENTER = "Center",
    UPPER_LEFT = "Upper Left",
    UPPER_RIGHT = "Upper Right",
    LOWER_LEFT = "Lower Left",
    LOWER_RIGHT = "Lower Right",
    TOP = "Top",
    BOTTOM = "Bottom",
    LEFT = "Left",
    RIGHT = "Right"
}

export enum FontStyle {
    NORMAL = "Normal",
    BOLD = "Bold",
    ITALIC = "Italic",
    BOLD_ITALIC = "Italic Bold"
}

export enum Font {
    HELVETICA = "Helvetica",
    TIMES = "Times",
    COURIER = "Courier"
}

export class PointAnnotationStore extends RegionStore {
    @observable pointShape: CARTA.PointAnnotationShape;
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
        pointShape: CARTA.PointAnnotationShape = CARTA.PointAnnotationShape.SQUARE,
        pointWidth: number = 6,
        rotation: number = 0,
        name: string = ""
    ) {
        super(backendService, fileId, activeFrame, controlPoints, regionType, regionId, color, lineWidth, dashLength, rotation, name);
        makeObservable(this);
        this.pointShape = pointShape || CARTA.PointAnnotationShape.SQUARE;
        this.pointWidth = pointWidth || 6;
        this.modifiedTimestamp = performance.now();
    }

    @action setPointShape = (pointShape: CARTA.PointAnnotationShape) => {
        this.pointShape = pointShape;
        this.modifiedTimestamp = performance.now();
    };

    @action setPointWidth = (width: number) => {
        this.pointWidth = width;
        this.modifiedTimestamp = performance.now();
    };
}

export class TextAnnotationStore extends RegionStore {
    @observable text: string = "Double click to edit text";
    @observable fontSize: number = 20;
    @observable fontStyle: FontStyle = FontStyle.NORMAL;
    @observable font: Font = Font.HELVETICA;
    @observable position: TextAnnotationPosition = TextAnnotationPosition.CENTER;

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
        this.modifiedTimestamp = performance.now();
    }

    @action setText = (text: string) => {
        this.text = text;
        this.modifiedTimestamp = performance.now();
    };

    @action setFontSize = (fontSize: number) => {
        this.fontSize = fontSize;
        this.modifiedTimestamp = performance.now();
    };

    @action setFontStyle = (fontStyle: FontStyle) => {
        this.fontStyle = fontStyle;
        this.modifiedTimestamp = performance.now();
    };

    @action setFont = (font: Font) => {
        this.font = font;
        this.modifiedTimestamp = performance.now();
    };

    @action setPosition = (position: TextAnnotationPosition) => {
        this.position = position;
        this.modifiedTimestamp = performance.now();
    };
}

export class VectorAnnotationStore extends RegionStore {
    @observable pointerWidth: number = 10;
    @observable pointerLength: number = 10;

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
        this.modifiedTimestamp = performance.now();
    }

    @action setPointerWidth = (pointerWidth: number) => {
        this.pointerWidth = pointerWidth;
        this.modifiedTimestamp = performance.now();
    };

    @action setPointerLength = (pointerLength: number) => {
        this.pointerLength = pointerLength;
        this.modifiedTimestamp = performance.now();
    };
}

export class CompassAnnotationStore extends RegionStore {
    @observable length: number = 100;
    @observable northLabel: string = "N";
    @observable eastLabel: string = "E";
    @observable fontSize: number = 20;
    @observable fontStyle: FontStyle = FontStyle.NORMAL;
    @observable font: Font = Font.HELVETICA;
    @observable pointerWidth: number = 10;
    @observable pointerLength: number = 10;
    @observable northTextOffset: Point2D = {x: 0, y: 0};
    @observable eastTextOffset: Point2D = {x: 0, y: 0};
    @observable northArrowhead: boolean = true;
    @observable eastArrowhead: boolean = true;
    // @observable northTextOffset: Point2D = {x: 5, y: 15};
    // @observable eastTextOffset: Point2D = {x: 15, y: 5};

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
        this.modifiedTimestamp = performance.now();
        // this.setLength(Math.max(this.activeFrame.frameInfo.fileInfoExtended.width, this.activeFrame.frameInfo.fileInfoExtended.height) * 0.1);
    }

    @action setLabel = (label: string, isNorth: boolean) => {
        if (isNorth) {
            this.northLabel = label;
        } else {
            this.eastLabel = label;
        }
        this.modifiedTimestamp = performance.now();
    };

    @action setFontSize = (fontSize: number) => {
        this.fontSize = fontSize;
        this.modifiedTimestamp = performance.now();
    };

    @action setFontStyle = (fontStyle: FontStyle) => {
        this.fontStyle = fontStyle;
        this.modifiedTimestamp = performance.now();
    };

    @action setFont = (font: Font) => {
        this.font = font;
        this.modifiedTimestamp = performance.now();
    };

    @action setPointerWidth = (width: number) => {
        this.pointerWidth = width;
        this.modifiedTimestamp = performance.now();
    };

    @action setPointerLength = (length: number) => {
        this.pointerLength = length;
        this.modifiedTimestamp = performance.now();
    };

    @action setLength = (length: number) => {
        this.length = Math.abs(length);
        this.modifiedTimestamp = performance.now();
    };

    @action setNorthTextOffset = (offset: number, isX: boolean, skipTimeStampUpdate: boolean = false) => {
        if (isX) {
            this.northTextOffset = {...this.northTextOffset, x: offset};
        } else {
            this.northTextOffset = {...this.northTextOffset, y: offset};
        }
        if (!skipTimeStampUpdate) {
            this.modifiedTimestamp = performance.now();
        }
    };

    @action setEastTextOffset = (offset: number, isX: boolean, skipTimeStampUpdate: boolean = false) => {
        if (isX) {
            this.eastTextOffset = {...this.eastTextOffset, x: offset};
        } else {
            this.eastTextOffset = {...this.eastTextOffset, y: offset};
        }
        if (!skipTimeStampUpdate) {
            this.modifiedTimestamp = performance.now();
        }
    };

    @action setNorthArrowhead = (northArrowhead: boolean) => {
        this.northArrowhead = northArrowhead;
        this.modifiedTimestamp = performance.now();
    };

    @action setEastArrowhead = (eastArrowhead: boolean) => {
        this.eastArrowhead = eastArrowhead;
        this.modifiedTimestamp = performance.now();
    };

    public getRegionApproximation(astTransform: AST.FrameSet, spatiallyMatched?: boolean, spatialTransform?: AST.FrameSet): any {
        const originPoint = spatiallyMatched ? transformPoint(spatialTransform, this.controlPoints[0], false) : this.controlPoints[0];
        const transformed = AST.transformPoint(astTransform, originPoint.x, originPoint.y);

        const delta1 = this.activeFrame.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.includes("CDELT1"));
        const delta2 = this.activeFrame.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.includes("CDELT2"));
        const frameView = this.activeFrame.requiredFrameViewForRegionRender;
        const top = frameView.yMax;
        const bottom = frameView.yMin;
        const left = frameView.xMin;
        const right = frameView.xMax;
        const width = right - left;
        const height = top - bottom;
        const angularWidth = delta1 ? Math.abs((delta1?.numericValue * Math.PI * width) / 180) : 6.18;
        const angularHeight = delta2 ? Math.abs((delta2?.numericValue * Math.PI * height) / 180) : 6.18;

        const northApproximatePoints = AST.transformAxPointList(astTransform, 2, transformed.x, transformed.y, delta1 ? angularWidth : 6.18);
        const eastApproximatePoints = AST.transformAxPointList(astTransform, 1, transformed.x, transformed.y, delta2 ? angularHeight : 6.18);
        // const northApproximatePoints = AST.transformAxPointList(astTransform, 2, transformed.x, transformed.y, delta1 ? Math.abs((delta1?.numericValue * Math.PI * this.activeFrame.frameInfo.fileInfoExtended.width) / 180) : 6.18);
        // const eastApproximatePoints = AST.transformAxPointList(astTransform, 1, transformed.x, transformed.y, delta2 ? Math.abs((delta2?.numericValue * Math.PI * this.activeFrame.frameInfo.fileInfoExtended.height) / 180) : 6.18);

        return {northApproximatePoints, eastApproximatePoints};
    }
}

export class RulerAnnotationStore extends RegionStore {
    @observable fontSize: number = 13;
    @observable fontStyle: FontStyle = FontStyle.NORMAL;
    @observable font: Font = Font.HELVETICA;
    @observable auxiliaryLineVisible: boolean = true;
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
        this.modifiedTimestamp = performance.now();
    }

    @action setFontSize = (fontSize: number) => {
        this.fontSize = fontSize;
        this.modifiedTimestamp = performance.now();
    };

    @action setFontStyle = (fontStyle: FontStyle) => {
        this.fontStyle = fontStyle;
        this.modifiedTimestamp = performance.now();
    };

    @action setFont = (font: Font) => {
        this.font = font;
        this.modifiedTimestamp = performance.now();
    };

    @action setAuxiliaryLineVisible = (isVisible: boolean) => {
        this.auxiliaryLineVisible = isVisible;
        this.modifiedTimestamp = performance.now();
    };

    @action setAuxiliaryLineDashLength = (length: number) => {
        this.auxiliaryLineDashLength = length;
        this.modifiedTimestamp = performance.now();
    };

    @action setTextOffset = (offset: number, isX: boolean) => {
        if (isX) {
            this.textOffset = {...this.textOffset, x: offset};
        } else {
            this.textOffset = {...this.textOffset, y: offset};
        }
        this.modifiedTimestamp = performance.now();
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
