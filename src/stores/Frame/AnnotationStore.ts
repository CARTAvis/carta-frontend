import {Colors} from "@blueprintjs/core";
import * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";
import {action, makeObservable, observable} from "mobx";

import {Point2D} from "models";
import {BackendService} from "services";
import {FrameStore} from "stores/Frame";
import {transformPoint} from "utilities";

import {RegionStore} from "./Region/RegionStore";

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

const NUMBER_OF_POINT_TRANSFORMED = 201;

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
        rotation: number = 0,
        name: string = "",
        color: string = Colors.TURQUOISE5,
        lineWidth: number = 2,
        dashLength: number = 0,
        pointShape: CARTA.PointAnnotationShape = CARTA.PointAnnotationShape.SQUARE,
        pointWidth: number = 6
    ) {
        super(backendService, fileId, activeFrame, controlPoints, regionType, regionId, rotation, name, color, lineWidth, dashLength);
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

    public getAnnotationStyles = () => {
        return {
            pointShape: this.pointShape,
            pointWidth: this.pointWidth
        };
    };

    public getAnnotationStylesForExport = () => {
        return {
            pointShape: this.pointShape,
            pointWidth: this.pointWidth
        };
    };

    public initializeStyles = (annotationStyles: {pointShape: CARTA.PointAnnotationShape; pointWidth: number}) => {
        this.setPointShape(annotationStyles.pointShape);
        this.setPointWidth(annotationStyles.pointWidth);
    };
}

export class TextAnnotationStore extends RegionStore {
    @observable text: string = "Double click to edit text";
    @observable fontSize: number = 20;
    @observable fontStyle: FontStyle = FontStyle.NORMAL;
    @observable font: Font = Font.HELVETICA;
    @observable position: CARTA.TextAnnotationPosition = CARTA.TextAnnotationPosition.CENTER;

    constructor(
        backendService: BackendService,
        fileId: number,
        activeFrame: FrameStore,
        controlPoints: Point2D[],
        regionType: CARTA.RegionType,
        regionId: number = -1,
        rotation: number = 0,
        name: string = "",
        color: string = Colors.TURQUOISE5,
        lineWidth: number = 2,
        dashLength: number = 0
    ) {
        super(backendService, fileId, activeFrame, controlPoints, regionType, regionId, rotation, name, color, lineWidth, dashLength);
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

    @action setFontStyle = (fontStyle: string) => {
        switch (fontStyle) {
            case "bold":
                this.fontStyle = FontStyle.BOLD;
                break;
            case "italic":
                this.fontStyle = FontStyle.ITALIC;
                break;
            case "bold_italic":
                this.fontStyle = FontStyle.BOLD_ITALIC;
                break;
            default:
                this.fontStyle = fontStyle as FontStyle;
        }
        this.modifiedTimestamp = performance.now();
    };

    @action setFont = (font: Font) => {
        this.font = font;
        this.modifiedTimestamp = performance.now();
    };

    @action setPosition = (position: CARTA.TextAnnotationPosition) => {
        this.position = position;
        this.modifiedTimestamp = performance.now();
    };

    public getAnnotationStyles = () => {
        return {
            textLabel0: this.text,
            fontSize: this.fontSize,
            fontStyle: this.fontStyle,
            font: this.font,
            textPosition: this.position
        };
    };

    public getAnnotationStylesForExport = () => {
        return {
            textLabel0: this.text,
            fontSize: this.fontSize,
            fontStyle: this.fontStyle,
            font: this.font,
            textPosition: this.position
        };
    };

    public initializeStyles = (annotationStyles: {textLabel0: string; fontSize: number; fontStyle: FontStyle; font: Font; textPosition: CARTA.TextAnnotationPosition}) => {
        this.setText(annotationStyles.textLabel0 ?? this.text);
        this.setFontSize(annotationStyles.fontSize || this.fontSize);
        this.setFontStyle(annotationStyles.fontStyle || this.fontStyle);
        this.setFont(annotationStyles.font || this.font);
        this.setPosition(annotationStyles.textPosition || this.position);
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
        rotation: number = 0,
        name: string = "",
        color: string = Colors.TURQUOISE5,
        lineWidth: number = 2,
        dashLength: number = 0
    ) {
        super(backendService, fileId, activeFrame, controlPoints, regionType, regionId, rotation, name, color, lineWidth, dashLength);
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

    public getAnnotationStyles = () => {
        return {
            pointerWidth: this.pointerWidth,
            pointerLength: this.pointerLength
        };
    };

    public initializeStyles = (annotationStyles: {pointerWidth: number; pointerLength: number}) => {
        this.setPointerWidth(annotationStyles.pointerWidth ?? this.pointerWidth);
        this.setPointerLength(annotationStyles.pointerLength ?? this.pointerLength);
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

    constructor(
        backendService: BackendService,
        fileId: number,
        activeFrame: FrameStore,
        controlPoints: Point2D[],
        regionType: CARTA.RegionType,
        regionId: number = -1,
        rotation: number = 0,
        name: string = "",
        color: string = Colors.TURQUOISE5,
        lineWidth: number = 2,
        dashLength: number = 0
    ) {
        super(backendService, fileId, activeFrame, controlPoints, regionType, regionId, rotation, name, color, lineWidth, dashLength);
        makeObservable(this);
        this.modifiedTimestamp = performance.now();
        this.setLength(controlPoints[1].x, true);
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

    @action setFontStyle = (fontStyle: string) => {
        switch (fontStyle) {
            case "bold":
                this.fontStyle = FontStyle.BOLD;
                break;
            case "italic":
                this.fontStyle = FontStyle.ITALIC;
                break;
            case "bold_italic":
                this.fontStyle = FontStyle.BOLD_ITALIC;
                break;
            default:
                this.fontStyle = fontStyle as FontStyle;
        }
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

    @action setLength = (length: number, skipUpdate: boolean = false) => {
        this.length = Math.abs(length);
        this.setControlPoint(1, {x: length, y: length}, skipUpdate);
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

    public getCompassApproximation(wcsInfo: AST.FrameSet, spatiallyMatched?: boolean, spatialTransform?: AST.Mapping): {northApproximatePoints: number[]; eastApproximatePoints: number[]} {
        const originPoint = spatiallyMatched ? transformPoint(spatialTransform, this.controlPoints[0], false) : this.controlPoints[0];
        const transformed = AST.transformPoint(wcsInfo, originPoint.x, originPoint.y);

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

        const northApproximatePoints = AST.getAxisPointArray(wcsInfo, NUMBER_OF_POINT_TRANSFORMED, 2, transformed.x, transformed.y, delta1 ? angularWidth : 6.18);
        const eastApproximatePoints = AST.getAxisPointArray(wcsInfo, NUMBER_OF_POINT_TRANSFORMED, 1, transformed.x, transformed.y, delta2 ? angularHeight : 6.18);

        return {northApproximatePoints, eastApproximatePoints};
    }

    public getAnnotationStyles = () => {
        return {
            textLabel0: this.northLabel,
            textLabel1: this.eastLabel,
            isNorthArrow: this.northArrowhead,
            isEastArrow: this.eastArrowhead,
            fontSize: this.fontSize,
            fontStyle: this.fontStyle,
            font: this.font,
            northTextOffset: this.northTextOffset,
            eastTextOffset: this.eastTextOffset,
            pointerWidth: this.pointerWidth,
            pointerLength: this.pointerLength,
            length: this.length
        };
    };

    public getAnnotationStylesForExport = () => {
        return {
            textLabel0: this.northLabel,
            textLabel1: this.eastLabel,
            isNorthArrow: this.northArrowhead,
            isEastArrow: this.eastArrowhead,
            fontSize: this.fontSize,
            fontStyle: this.fontStyle,
            font: this.font,
            coordinateSystem: "PIXEL"
        };
    };

    public initializeStyles = (annotationStyles: {
        textLabel0: string;
        textLabel1: string;
        fontSize: number;
        fontStyle: FontStyle;
        font: Font;
        pointerWidth: number;
        pointerLength: number;
        length: number;
        northTextOffset: Point2D;
        eastTextOffset: Point2D;
        isNorthArrow: boolean;
        isEastArrow: boolean;
    }) => {
        this.setLabel(annotationStyles.textLabel0 ?? this.northLabel, true);
        this.setLabel(annotationStyles.textLabel1 ?? this.eastLabel, false);
        this.setFontSize(annotationStyles.fontSize ?? this.fontSize);
        this.setFontStyle(annotationStyles.fontStyle ?? this.fontStyle);
        this.setFont(annotationStyles.font ?? this.font);
        this.setPointerWidth(annotationStyles.pointerWidth ?? this.pointerWidth);
        this.setPointerLength(annotationStyles.pointerLength ?? this.pointerLength);
        this.setLength(annotationStyles.length ?? this.length, true);
        this.setNorthTextOffset(annotationStyles.northTextOffset?.x ?? this.northTextOffset.x, true);
        this.setNorthTextOffset(annotationStyles.northTextOffset?.y ?? this.northTextOffset.y, false);
        this.setEastTextOffset(annotationStyles.eastTextOffset?.x ?? this.eastTextOffset.x, true);
        this.setEastTextOffset(annotationStyles.eastTextOffset?.y ?? this.eastTextOffset.y, false);
        this.setNorthArrowhead(annotationStyles.isNorthArrow ?? this.northArrowhead);
        this.setEastArrowhead(annotationStyles.isEastArrow ?? this.eastArrowhead);
    };
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
        rotation: number = 0,
        name: string = "",
        color: string = Colors.TURQUOISE5,
        lineWidth: number = 2,
        dashLength: number = 0
    ) {
        super(backendService, fileId, activeFrame, controlPoints, regionType, regionId, rotation, name, color, lineWidth, dashLength);
        makeObservable(this);
        this.modifiedTimestamp = performance.now();
    }

    @action setFontSize = (fontSize: number) => {
        this.fontSize = fontSize;
        this.modifiedTimestamp = performance.now();
    };

    @action setFontStyle = (fontStyle: string) => {
        switch (fontStyle) {
            case "bold":
                this.fontStyle = FontStyle.BOLD;
                break;
            case "italic":
                this.fontStyle = FontStyle.ITALIC;
                break;
            case "bold_italic":
                this.fontStyle = FontStyle.BOLD_ITALIC;
                break;
            default:
                this.fontStyle = fontStyle as FontStyle;
        }
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

    public getCurveApproximation(wcsInfo: AST.FrameSet, mapping?: AST.Mapping): {xApproximatePoints: number[]; yApproximatePoints: number[]; hypotenuseApproximatePoints: number[]} {
        let xApproximatePoints;
        let yApproximatePoints;
        let hypotenuseApproximatePoints;

        const xIn = new Float64Array(2);
        const yIn = new Float64Array(2);

        // If matched, transform image coordinate of reference image to matched image using Mapping
        const imagePointStart = mapping ? transformPoint(mapping, this.controlPoints[0], false) : this.controlPoints[0];
        const imagePointFinish = mapping ? transformPoint(mapping, this.controlPoints[1], false) : this.controlPoints[1];
        xIn[0] = imagePointStart.x;
        xIn[1] = imagePointFinish.x;
        yIn[0] = imagePointStart.y;
        yIn[1] = imagePointFinish.y;

        const transformed = AST.transformPointArrays(wcsInfo, xIn, yIn);

        const startX = transformed.x[0];
        const finishX = transformed.x[1];
        const cornerX = transformed.x[1];
        const startY = transformed.y[0];
        const finishY = transformed.y[1];
        const cornerY = transformed.y[0];

        const corner = {x: cornerX, y: cornerY};
        const start = {x: startX, y: startY};
        const finish = {x: finishX, y: finishY};

        xApproximatePoints = AST.getGeodesicPointArray(wcsInfo, NUMBER_OF_POINT_TRANSFORMED, corner, start);
        yApproximatePoints = AST.getGeodesicPointArray(wcsInfo, NUMBER_OF_POINT_TRANSFORMED, finish, corner);
        hypotenuseApproximatePoints = AST.getGeodesicPointArray(wcsInfo, NUMBER_OF_POINT_TRANSFORMED, start, finish);

        return {xApproximatePoints, yApproximatePoints, hypotenuseApproximatePoints};
    }

    public getAnnotationStyles = () => {
        return {
            fontSize: this.fontSize,
            fontStyle: this.fontStyle,
            font: this.font,
            auxiliaryLineVisible: this.auxiliaryLineVisible,
            auxiliaryLineDashLength: this.auxiliaryLineDashLength,
            textOffset: this.textOffset
        };
    };

    public getAnnotationStylesForExport = () => {
        return {
            fontSize: this.fontSize,
            fontStyle: this.fontStyle,
            font: this.font,
            coordinateSystem: "PIXEL"
        };
    };

    public initializeStyles = (annotationStyles: {fontSize: number; fontStyle: FontStyle; font: Font; auxiliaryLineVisible: boolean; auxiliaryLineDashLength: number; textOffset: Point2D}) => {
        this.setFontSize(annotationStyles.fontSize ?? this.fontSize);
        this.setFontStyle(annotationStyles.fontStyle ?? this.fontStyle);
        this.setFont(annotationStyles.font ?? this.font);
        this.setAuxiliaryLineVisible(annotationStyles.auxiliaryLineVisible ?? this.auxiliaryLineVisible);
        this.setAuxiliaryLineDashLength(annotationStyles.auxiliaryLineDashLength ?? this.auxiliaryLineDashLength);
        this.setTextOffset(annotationStyles.textOffset?.x ?? this.textOffset.x, true);
        this.setTextOffset(annotationStyles.textOffset?.y ?? this.textOffset.y, false);
    };
}
