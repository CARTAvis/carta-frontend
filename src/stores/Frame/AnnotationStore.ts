import {action, observable, makeObservable} from "mobx";
import {Colors} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
// import * as AST from "ast_wrapper";
import {Point2D} from "models";
import {BackendService} from "services";
// import {AppStore} from "stores";
import {FrameStore} from "stores/Frame";
// import {CustomIconName} from "icons/CustomIcons";
import {RegionStore} from "./RegionStore";

export class AnnotationStore extends RegionStore {
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
    @observable compassLength: Point2D = {x: 0, y: 0};
    @observable endPoints: Point2D[] = [
        {x: 0, y: 0},
        {x: 0, y: 0}
    ];

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

    @action setEndPoints = (endPoints: Point2D[]) => {
        this.endPoints = endPoints;
    };
}
