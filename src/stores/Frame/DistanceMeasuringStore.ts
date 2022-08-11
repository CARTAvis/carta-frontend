import * as AST from "ast_wrapper";
import {action, computed, observable, makeObservable} from "mobx";
import {ImageViewLayer} from "components";
import {AppStore, AstColorsIndex, ASTSettingsString} from "stores";
import {getColorForTheme} from "utilities";
import {Point2D, Transform2D} from "models";

export class DistanceMeasuringStore {
    start: Point2D;
    finish: Point2D;

    @observable transformedStart: Point2D;
    @observable transformedFinish: Point2D;
    @observable isCreating: boolean;
    @observable color: string;

    static readonly DEFAULT_WIDTH = 1.5;
    static readonly DEFAULT_FONTSIZE = 14;
    static readonly DEFAULT_COLOR = "#62D96B";

    private static staticInstance: DistanceMeasuringStore;

    constructor() {
        makeObservable(this);
        this.transformedStart = {x: null, y: null};
        this.transformedFinish = {x: null, y: null};
        this.isCreating = false;
        this.color = DistanceMeasuringStore.DEFAULT_COLOR;
    }

    static get Instance() {
        if (!DistanceMeasuringStore.staticInstance) {
            DistanceMeasuringStore.staticInstance = new DistanceMeasuringStore();
        }
        return DistanceMeasuringStore.staticInstance;
    }

    @computed get showCurve(): boolean {
        return this.transformedStart.x != null && this.transformedStart.y != null && this.transformedFinish.x != null && this.transformedFinish.y != null && AppStore.Instance.activeLayer === ImageViewLayer.DistanceMeasuring;
    }

    @computed get styleString() {
        let astString = new ASTSettingsString();
        astString.add("Color(Curve)", AstColorsIndex.DISTANCE_MEASURE);
        astString.add("Width(Curve)", DistanceMeasuringStore.DEFAULT_WIDTH * AppStore.Instance.imageRatio);
        astString.add("Color(Strings)", AstColorsIndex.DISTANCE_MEASURE);
        astString.add("Size(Strings)", DistanceMeasuringStore.DEFAULT_FONTSIZE * AppStore.Instance.imageRatio);
        return astString.toString();
    }

    @action setIsCreating = isCreating => {
        this.isCreating = isCreating;
    };

    @action updateTransformedPos = (spatialTransform: Transform2D) => {
        if (this.start?.x != null && this.start?.y != null && this.finish?.x != null && this.finish?.y != null) {
            this.transformedStart = spatialTransform ? spatialTransform.transformCoordinate(this.start) : this.start;
            this.transformedFinish = spatialTransform ? spatialTransform.transformCoordinate(this.finish) : this.finish;
        }
    };

    @action resetPos = () => {
        this.start = {x: null, y: null};
        this.finish = {x: null, y: null};
        this.transformedStart = {x: null, y: null};
        this.transformedFinish = {x: null, y: null};
        this.isCreating = false;
    };

    @action setColor = (color: string) => {
        this.color = color;
        AST.setColor(getColorForTheme(color), AstColorsIndex.DISTANCE_MEASURE);
    };

    @action setTransformedStart(point: Point2D) {
        this.transformedStart = point;
    }

    @action setTransformedFinish(point: Point2D) {
        this.transformedFinish = point;
    }
}
