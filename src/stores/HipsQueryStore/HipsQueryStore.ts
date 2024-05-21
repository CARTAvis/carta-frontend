import {CARTA} from "carta-protobuf";
import {action, makeObservable, observable} from "mobx";

import {Point2D} from "models";
import {AppStore} from "stores/AppStore/AppStore";

export enum HipsCoord {
    Icrs = "icrs",
    Galactic = "galatic"
}

export enum HipsProjection {
    AZP = "AZP",
    SZP = "SZP",
    TAN = "TAN",
    STG = "STG",
    SIN = "SIN",
    ARC = "ARC",
    ZPN = "ZPN",
    ZEA = "ZEA",
    AIR = "AIR",
    CYP = "CYP",
    CEA = "CEA",
    CAR = "CAR",
    MER = "MER",
    COP = "COP",
    COE = "COE",
    COD = "COD",
    COO = "COO",
    SFL = "SFL",
    PAR = "PAR",
    MOL = "MOL",
    AIT = "AIT",
    BON = "BON",
    PCO = "PCO",
    TSC = "TSC",
    CSC = "CSC",
    QSC = "QSC",
    HPX = "HPX",
    XPH = "XPH"
}

export class HipsQueryStore {
    private static staticInstance: HipsQueryStore;

    @observable hipsSurvey = "";
    @observable size: Point2D = {x: NaN, y: NaN};
    @observable object = "";
    @observable center: Point2D = {x: NaN, y: NaN};
    @observable fov = NaN;
    @observable coordsys = HipsCoord.Icrs;
    @observable projection = HipsProjection.TAN;
    @observable rotationAngle = 0;

    static readonly ProjectionOptionMap = new Map([
        [HipsProjection.AZP, "zenithal/azimuthal perspective"],
        [HipsProjection.SZP, "slant zenithal perspective"],
        [HipsProjection.TAN, "gnomonic"],
        [HipsProjection.STG, "stereographic"],
        [HipsProjection.SIN, "orthographic/synthesis"],
        [HipsProjection.ARC, "zenithal/azimuthal equidistant"],
        [HipsProjection.ZPN, "zenithal/azimuthal polynomial"],
        [HipsProjection.ZEA, "zenithal/azimuthal equal area"],
        [HipsProjection.AIR, "Airy’s projection"],
        [HipsProjection.CYP, "cylindrical perspective"],
        [HipsProjection.CEA, "cylindrical equal area"],
        [HipsProjection.CAR, "plate carrée"],
        [HipsProjection.MER, "Mercator’s projection"],
        [HipsProjection.COP, "conic perspective"],
        [HipsProjection.COE, "conic equal area"],
        [HipsProjection.COD, "conic equidistant"],
        [HipsProjection.COO, "conic orthomorphic"],
        [HipsProjection.SFL, "Sanson-Flamsteed (“global sinusoid”)"],
        [HipsProjection.PAR, "parabolic"],
        [HipsProjection.MOL, "Mollweide’s projection"],
        [HipsProjection.AIT, "Hammer-Aitoff"],
        [HipsProjection.BON, "Bonne’s projection"],
        [HipsProjection.PCO, "polyconic"],
        [HipsProjection.TSC, "tangential spherical cube"],
        [HipsProjection.CSC, "COBE quadrilateralized spherical cube"],
        [HipsProjection.QSC, "quadrilateralized spherical cube"],
        [HipsProjection.HPX, "HEALPix"],
        [HipsProjection.XPH, "HEALPix polar, aka “butterfly”"]
    ]);

    static get Instance() {
        if (!HipsQueryStore.staticInstance) {
            HipsQueryStore.staticInstance = new HipsQueryStore();
        }
        return HipsQueryStore.staticInstance;
    }

    constructor() {
        makeObservable(this);
    }

    @action setHipsSurvey = (hipsSurvey: string) => {
        this.hipsSurvey = hipsSurvey;
    };

    @action setWidth = (width: number) => {
        this.size.x = width;
    };

    @action setHeight = (height: number) => {
        this.size.y = height;
    };

    @action setObject = (object: string) => {
        this.object = object;
    };

    @action setCenterX = (x: number) => {
        this.center.x = x;
    };

    @action setCenterY = (y: number) => {
        this.center.y = y;
    };

    @action setFov = (fov: number) => {
        this.fov = fov;
    };

    @action setCoordsys = (coordsys: HipsCoord) => {
        this.coordsys = coordsys;
    };

    @action setProjection = (projection: HipsProjection) => {
        this.projection = projection;
    };

    @action setRotationAngle = (rotationAngle: number) => {
        this.rotationAngle = rotationAngle;
    };

    queryByObject = () => {
        const message: CARTA.IRemoteFileRequest = {
            hips: this.hipsSurvey,
            width: this.size.x,
            height: this.size.y,
            object: this.object,
            fov: this.fov,
            coordsys: this.coordsys,
            projection: this.projection,
            rotationAngle: this.rotationAngle
        };
        AppStore.Instance.loadRemoteFile(message);
    };

    queryByCenter = () => {
        const message: CARTA.IRemoteFileRequest = {
            hips: this.hipsSurvey,
            width: this.size.x,
            height: this.size.y,
            ra: this.center.x,
            dec: this.center.y,
            fov: this.fov,
            coordsys: this.coordsys,
            projection: this.projection,
            rotationAngle: this.rotationAngle
        };
        AppStore.Instance.loadRemoteFile(message);
    };
}
