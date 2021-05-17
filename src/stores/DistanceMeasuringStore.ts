import * as AST from "ast_wrapper";
import {action, computed, observable, makeObservable} from "mobx";
import {ImageViewLayer} from "components";
import {AppStore, AstColorsIndex, ASTSettingsString} from "stores";
import {getColorForTheme} from "utilities";
import {Point2D} from "models";

export class DistanceMeasuringStore {
    @observable start: Point2D;
    @observable finish: Point2D;
    @observable isCreating: boolean;
    @observable color: string;

    static readonly DEFAULT_WIDTH = 1.5;
    static readonly DEFAULT_FONTSIZE = 14;
    static readonly DEFAULT_COLOR= '#62D96B';

    constructor() {
        makeObservable(this);
        this.start = {x: null, y: null};
        this.finish = {x: null, y: null};
        this.isCreating = false;
        this.color = DistanceMeasuringStore.DEFAULT_COLOR;
    }

    @computed get showCurve(): boolean {
        return (this.start.x != null && this.start.y != null && this.finish.x != null && this.finish.y != null && AppStore.Instance.activeLayer === ImageViewLayer.DistanceMeasuring);
    }

    @computed get styleString() {
        let astString = new ASTSettingsString();
        astString.add("Color(Curve)", AstColorsIndex.DISTANCE_MEASURE);
        astString.add("Width(Curve)", DistanceMeasuringStore.DEFAULT_WIDTH);
        astString.add("Color(Strings)", AstColorsIndex.DISTANCE_MEASURE);
        astString.add("Size(Strings)", DistanceMeasuringStore.DEFAULT_FONTSIZE);
        return astString.toString();
    }

    @action setIsCreating = (isCreating) => {
        this.isCreating = isCreating;
    };

    @action setStart = (pos: Point2D) => {
        this.start = pos;
    };

    @action setFinish = (pos: Point2D) => {
        this.finish = pos;
    };

    @action resetPos = () => {
        this.start = {x: null, y: null};
        this.finish = {x: null, y: null};
        this.isCreating = false;
    };

    @action setColor = (color: string) => {
        this.color = color;
        AST.setColor(getColorForTheme(color), AstColorsIndex.DISTANCE_MEASURE);
    };
}