import * as AST from "ast_wrapper";
import {action, computed, makeObservable, observable} from "mobx";

import {ImageViewLayer} from "components";
import {Point2D, Transform2D} from "models";
import {AppStore, AstColorsIndex, ASTSettingsString} from "stores";
import {getColorForTheme} from "utilities";

export class DistanceMeasuringStore {
    @observable start: Point2D;
    @observable finish: Point2D;

    @observable transformedStart: Point2D;
    @observable transformedFinish: Point2D;
    @observable isCreating: boolean;
    @observable color: string;
    @observable lineWidth: number;
    @observable fontSize: number;

    static readonly DEFAULT_WIDTH = 1.5;
    static readonly DEFAULT_FONTSIZE = 14;
    static readonly DEFAULT_COLOR = "#62D96B";

    constructor() {
        makeObservable(this);
        this.start = {x: 0, y: 0};
        this.finish = {x: 0, y: 0};
        this.transformedStart = {x: NaN, y: NaN};
        this.transformedFinish = {x: NaN, y: NaN};
        this.isCreating = false;
        this.color = DistanceMeasuringStore.DEFAULT_COLOR;
        this.lineWidth = DistanceMeasuringStore.DEFAULT_WIDTH;
        this.fontSize = DistanceMeasuringStore.DEFAULT_FONTSIZE;
    }

    @computed get showCurve(): boolean {
        return !isNaN(this.transformedStart.x) && !isNaN(this.transformedStart.y) && !isNaN(this.transformedFinish.x) && !isNaN(this.transformedFinish.y) && AppStore.Instance.activeLayer === ImageViewLayer.DistanceMeasuring;
    }

    @computed get styleString() {
        AST.setColor(getColorForTheme(this.color), AstColorsIndex.DISTANCE_MEASURE);
        let astString = new ASTSettingsString();
        astString.add("Color(Curve)", AstColorsIndex.DISTANCE_MEASURE);
        astString.add("Width(Curve)", this.lineWidth * AppStore.Instance.imageRatio);
        astString.add("Color(Strings)", AstColorsIndex.DISTANCE_MEASURE);
        astString.add("Size(Strings)", this.fontSize * AppStore.Instance.imageRatio);
        return astString.toString();
    }

    @action setIsCreating = isCreating => {
        this.isCreating = isCreating;
    };

    @action updateTransformedPos = (spatialTransform: Transform2D) => {
        if (!isNaN(this.start?.x) && !isNaN(this.start?.y) && !isNaN(this.finish?.x) && !isNaN(this.finish?.y)) {
            this.transformedStart = spatialTransform ? spatialTransform.transformCoordinate(this.start) : this.start;
            this.transformedFinish = spatialTransform ? spatialTransform.transformCoordinate(this.finish) : this.finish;
        }
    };

    @action resetPos = () => {
        this.start = {x: 0, y: 0};
        this.finish = {x: 0, y: 0};
        this.transformedStart = {x: NaN, y: NaN};
        this.transformedFinish = {x: NaN, y: NaN};
        this.isCreating = false;
    };

    @action setColor = (color: string) => {
        this.color = color;
        AST.setColor(getColorForTheme(color), AstColorsIndex.DISTANCE_MEASURE);
    };

    @action setLineWidth = (width: number) => {
        this.lineWidth = width;
    };

    @action setFontSize = (size: number) => {
        this.fontSize = size;
    };

    @action setStart = (x: number, y: number) => {
        this.start = {x: x || NaN, y: y || NaN};
    };

    @action setFinish = (x: number, y: number) => {
        this.finish = {x: x || NaN, y: y || NaN};
    };
}
