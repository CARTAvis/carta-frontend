import axios from "axios";
import {CARTA} from "carta-protobuf";
import {action, computed, makeObservable, observable} from "mobx";

import {Point2D} from "models";
import {AppStore} from "stores";

/** A HiPS survey. */
export interface HipsSurvey {
    /** The ID of the survey. */
    name: string;
    /** The data product type of the survey. */
    type: "Sky map" | "Planet map" | "Cube";
}

/** Coordinate systems for HiPS data queries. */
export enum HipsCoord {
    Icrs = "icrs",
    Galactic = "galactic"
}

/** Projection types for HiPS data queries. */
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

/** Management of HiPS data queries. */
export class HipsQueryStore {
    private static staticInstance: HipsQueryStore;

    /** A list of available HiPS surveys. */
    surveyList: HipsSurvey[] = [];
    /** The HiPS survey to be used. */
    @observable hipsSurvey = "";
    /** The width and height of the output image. */
    @observable size: Point2D = {x: NaN, y: NaN};
    /** The object name on which the output image will be centered. */
    @observable object = "";
    /** The center coordinates of the output image. */
    @observable center: Point2D = {x: NaN, y: NaN};
    /** The field of view of the output image. */
    @observable fov = NaN;
    /** The coordinate system of the output image. */
    @observable coordsys = HipsCoord.Icrs;
    /** The projection type of the output image. */
    @observable projection = HipsProjection.TAN;
    /** The rotation angle of the output image. */
    @observable rotationAngle = 0;
    /** Whether the query is in progress. */
    @observable isLoading = false;

    /** Whether the current state is valid for a HiPS data query. */
    @computed get isValid(): boolean {
        return this.hipsSurvey.length > 0 && this.isDimensionValid && (this.object.length > 0 || (isFinite(this.center.x) && isFinite(this.center.y))) && this.isFovValid && this.isRotAngleValid && !this.isLoading;
    }

    @computed get isDimensionValid(): boolean {
        return this.size.x >= this.HipsConstraint.MinDimension && this.size.y >= this.HipsConstraint.MinDimension && this.size.x * this.size.y <= this.HipsConstraint.MaxDimension;
    }

    @computed get isFovValid(): boolean {
        return this.fov > this.HipsConstraint.MinFov && this.fov <= this.HipsConstraint.MaxFov;
    }

    @computed get isRotAngleValid(): boolean {
        return this.rotationAngle >= this.HipsConstraint.MinRotAngle && this.rotationAngle <= this.HipsConstraint.MaxRotAngle;
    }

    @computed get pixelSize(): number {
        const selectedSide = isNaN(this.size.x) || isNaN(this.size.y) ? (isNaN(this.size.x) ? this.size.y : this.size.x) : Math.max(this.size.x, this.size.y);
        return this.fov / selectedSide;
    }

    /** HiPS projection types and their descriptions. */
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

    readonly HipsConstraint = {
        MinDimension: 5,
        MaxDimension: 5e7,
        MinFov: 0,
        MaxFov: 360,
        MinRotAngle: 0,
        MaxRotAngle: 360
    };

    static get Instance() {
        if (!HipsQueryStore.staticInstance) {
            HipsQueryStore.staticInstance = new HipsQueryStore();
        }
        return HipsQueryStore.staticInstance;
    }

    constructor() {
        makeObservable(this);
        this.fetchSurveyList();
    }

    /**
     * Sets the HiPS survey to be used.
     * @param hipsSurvey - The HiPS survey to set.
     */
    @action setHipsSurvey = (hipsSurvey: string) => {
        this.hipsSurvey = hipsSurvey;
    };

    /**
     * Sets the width of the output image.
     * @param width - The width to set.
     */
    @action setWidth = (width: number) => {
        this.size.x = width;
    };

    /**
     * Sets the height of the output image.
     * @param height - The height to set.
     */
    @action setHeight = (height: number) => {
        this.size.y = height;
    };

    /**
     * Sets the object name on which the output image will be centered.
     * @param object - The object name to set.
     */
    @action setObject = (object: string) => {
        this.object = object;
    };

    /**
     * Sets the center x coordinate of the output image.
     * @param x - The center x coordinate to set.
     */
    @action setCenterX = (x: number) => {
        this.center.x = x;
    };

    /**
     * Sets the center y coordinate of the output image.
     * @param y - The center y coordinate to set.
     */
    @action setCenterY = (y: number) => {
        this.center.y = y;
    };

    /**
     * Sets the field of view of the output image.
     * @param fov - The field of view to set (degree).
     */
    @action setFov = (fov: number) => {
        this.fov = fov;
    };

    /**
     * Sets the coordinate system of the output image.
     * @param coordsys - The coordinate system to set.
     */
    @action setCoordsys = (coordsys: HipsCoord) => {
        this.coordsys = coordsys;
    };

    /**
     * Sets the projection type of the output image.
     * @param projection - The projection type to set.
     */
    @action setProjection = (projection: HipsProjection) => {
        this.projection = projection;
    };

    /**
     * Sets the rotation angle of the output image.
     * @param rotationAngle - The rotation angle to set (degree).
     */
    @action setRotationAngle = (rotationAngle: number) => {
        this.rotationAngle = rotationAngle;
    };

    /**
     * Updates the query state.
     * @param isLoading - Whether the query is in progress.
     */
    @action setIsLoading = (isLoading: boolean) => {
        this.isLoading = isLoading;
    };

    /** Resets the input parameters. */
    @action clear = () => {
        this.hipsSurvey = "";
        this.size = {x: NaN, y: NaN};
        this.object = "";
        this.center = {x: NaN, y: NaN};
        this.fov = NaN;
        this.coordsys = HipsCoord.Icrs;
        this.projection = HipsProjection.TAN;
        this.rotationAngle = 0;
    };

    /** Sends a HiPS data query by the object name. */
    queryByObject = async () => {
        if (!this.object || !this.isValid) {
            return;
        }

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
        this.setIsLoading(true);
        try {
            await AppStore.Instance.loadRemoteFile(message);
        } catch (err) {
            console.log(err);
        }
        this.setIsLoading(false);
    };

    /** Sends a HiPS data query by the center coordinates. */
    queryByCenter = async () => {
        if (!isFinite(this.center.x) || !isFinite(this.center.y) || !this.isValid) {
            return;
        }

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
        this.setIsLoading(true);
        try {
            await AppStore.Instance.loadRemoteFile(message);
        } catch (err) {
            console.log(err);
        }
        this.setIsLoading(false);
    };

    /** Gets the list of available HiPS surveys which provide FITS format. */
    private fetchSurveyList = async () => {
        try {
            const skyMaps = await axios.get(
                "https://alasky.cds.unistra.fr/MocServer/query?expr=(hips_frame%3Dequatorial%2Cgalactic%2Cecliptic+||+hips_frame%3D!*)+%26%26+dataproduct_type!%3Dcatalog%2Ccube+%26%26+hips_service_url%3D*+%26%26+hips_tile_format=*fits*&get=id&fmt=json"
            );
            if (skyMaps?.data) {
                this.surveyList = skyMaps?.data.map(x => ({name: x, type: "Sky map"}));
            }

            const planetMaps = await axios.get(
                "https://alasky.cds.unistra.fr/MocServer/query?expr=hips_frame!%3Dequatorial%2Cgalactic%2Cecliptic+%26%26+hips_frame%3D*+%26%26+dataproduct_type!%3Dcatalog%2Ccube+%26%26+hips_service_url%3D*+%26%26+hips_tile_format=*fits*&get=id&fmt=json"
            );
            if (planetMaps?.data) {
                planetMaps.data.forEach(x => this.surveyList.push({name: x, type: "Planet map"}));
            }

            const cubes = await axios.get("https://alasky.cds.unistra.fr/MocServer/query?hips_service_url=*&dataproduct_type=cube&hips_tile_format=*fits*&get=id&fmt=json");
            if (cubes?.data) {
                cubes.data.forEach(x => this.surveyList.push({name: x, type: "Cube"}));
            }
        } catch (error) {
            console.error(error);
        }
    };
}
