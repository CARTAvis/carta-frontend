import * as AST from "ast_wrapper";
import {action, observable, makeObservable, reaction, computed} from "mobx";
import {CatalogSystemType, Point2D} from "models";
import {AppStore, OverlayStore, NumberFormatType, ASTSettingsString, SystemType} from "stores";
import {CatalogDatabase} from "services";
import {clamp, getPixelValueFromWCS, transformPoint, VizieResource} from "utilities";

export enum RadiusUnits {
    DEGREES = "deg",
    ARCMINUTES = "arcmin",
    ARCSECONDS = "arcsec"
}

export type VizieRItem = {name: string; description: string};

export class CatalogOnlineQueryConfigStore {
    private static staticInstance: CatalogOnlineQueryConfigStore;
    public static readonly MIN_OBJECTS = 1;
    public static readonly MAX_OBJECTS = 50000;
    public static readonly OBJECT_SIZE = 1000;

    @observable isQuerying: boolean;
    @observable catalogDB: CatalogDatabase;
    @observable searchRadius: number;
    @observable coordsType: CatalogSystemType;
    @observable coordsFormat: NumberFormatType;
    @observable centerPixelCoord: {x: string; y: string};
    @observable maxObject: number;
    @observable enablePointSelection: boolean;
    @observable radiusUnits: RadiusUnits;
    @observable objectName: string;
    @observable isObjectQuerying: boolean;
    //Vizier
    @observable vizierResource: Map<string, VizieResource>;
    @observable vizierSelectedTableName: VizieRItem[];
    @observable vizierKeyWords: string;

    constructor() {
        makeObservable(this);
        this.isQuerying = false;
        this.catalogDB = CatalogDatabase.SIMBAD;
        this.searchRadius = 1;
        // In Simbad, the coordinate system parameter is never interpreted. All coordinates MUST be expressed in the ICRS coordinate system
        this.coordsType = CatalogSystemType.ICRS;
        this.centerPixelCoord = {x: undefined, y: undefined};
        this.maxObject = CatalogOnlineQueryConfigStore.OBJECT_SIZE;
        this.enablePointSelection = false;
        this.radiusUnits = RadiusUnits.DEGREES;
        this.coordsFormat = NumberFormatType.Degrees;
        this.objectName = "";
        this.isObjectQuerying = false;
        this.vizierSelectedTableName = [];
        this.vizierResource = new Map();
        this.vizierKeyWords = "";

        reaction(
            () => AppStore.Instance.activeFrame,
            () => {
                this.resetSearchRadius();
            }
        );

        reaction(
            () => AppStore.Instance.cursorFrozen,
            cursorFrozen => {
                const frame = this.activeFrame;
                if (cursorFrozen && frame?.cursorInfo?.posImageSpace) {
                    this.updateCenterPixelCoord(frame.cursorInfo.posImageSpace);
                    this.resetObjectName();
                }
            }
        );
    }

    static get Instance() {
        if (!CatalogOnlineQueryConfigStore.staticInstance) {
            CatalogOnlineQueryConfigStore.staticInstance = new CatalogOnlineQueryConfigStore();
        }
        return CatalogOnlineQueryConfigStore.staticInstance;
    }

    public setFrameCenter() {
        const frame = this.activeFrame;
        if (frame?.center) {
            this.updateCenterPixelCoord(frame.center);
            this.resetObjectName();
        }
    }

    @action setVizierKeyWords(keyWords: string) {
        this.vizierKeyWords = keyWords;
    }

    @action setVizierQueryResult(resources: Map<string, VizieResource>) {
        this.vizierResource = resources;
    }

    @action updateVizierSelectedTable(table: VizieRItem) {
        if (!this.vizierSelectedTableName.includes(table)) {
            this.vizierSelectedTableName.push(table);
        }
    }

    @action removeVizierSelectedTable(table: string) {
        this.vizierSelectedTableName = this.vizierSelectedTableName.filter(element => table !== element.name);
    }

    @action resetVizierSelectedTable() {
        this.vizierSelectedTableName = [];
    }

    @action resetVizirR() {
        this.vizierResource.clear();
        this.resetVizierSelectedTable();
    }

    @action setQueryStatus(isQuerying: boolean) {
        this.isQuerying = isQuerying;
    }

    @action setCatalogDB(db: CatalogDatabase) {
        this.catalogDB = db;
    }

    @action setSearchRadius(radius: number) {
        this.searchRadius = radius;
    }

    @action setCoordsType(type: CatalogSystemType) {
        this.coordsType = type;
    }

    @action updateCenterPixelCoord(center: Point2D) {
        this.centerPixelCoord.x = center.x.toString();
        this.centerPixelCoord.y = center.y.toString();
    }

    @action setMaxObjects(size: number) {
        this.maxObject = size;
    }

    @action resetMaxObjects() {
        this.maxObject = CatalogOnlineQueryConfigStore.OBJECT_SIZE;
    }

    @action setPointSelection() {
        this.enablePointSelection = !this.enablePointSelection;
    }

    @action setRadiusUnits(units: RadiusUnits) {
        switch (units) {
            case RadiusUnits.ARCMINUTES:
                this.setSearchRadius(this.radiusAsArcm);
                break;
            case RadiusUnits.ARCSECONDS:
                this.setSearchRadius(this.radiusAsArcs);
                break;
            default:
                this.setSearchRadius(this.radiusAsDeg);
                break;
        }
        this.radiusUnits = units;
    }

    @action setCoordsFormat(format: NumberFormatType) {
        this.coordsFormat = format;
    }

    @action setObjectName(object: string) {
        this.objectName = object;
    }

    @action resetObjectName() {
        this.objectName = "";
    }

    @action setObjectQueryStatus(isQuerying: boolean) {
        this.isObjectQuerying = isQuerying;
    }

    @action resetSearchRadius() {
        let radius = this.searchRadiusInDegree;
        switch (this.radiusUnits) {
            case RadiusUnits.ARCMINUTES:
                radius = radius * 60;
                break;
            case RadiusUnits.ARCSECONDS:
                radius = radius * 3600;
                break;
            default:
                break;
        }
        this.setSearchRadius(radius);
        this.setFrameCenter();
    }

    @computed get radiusAsDeg(): number {
        let radius = this.searchRadius;
        switch (this.radiusUnits) {
            case RadiusUnits.ARCMINUTES:
                radius = radius * (1 / 60);
                break;
            case RadiusUnits.ARCSECONDS:
                radius = radius * (1 / 3600);
                break;
            default:
                break;
        }
        return Number(radius.toPrecision(6));
    }

    @computed get radiusAsArcm(): number {
        let radius = this.searchRadius;
        switch (this.radiusUnits) {
            case RadiusUnits.DEGREES:
                radius = radius * 60;
                break;
            case RadiusUnits.ARCSECONDS:
                radius = radius * (1 / 60);
                break;
            default:
                break;
        }
        return Number(radius.toPrecision(6));
    }

    @computed get radiusAsArcs(): number {
        let radius = this.searchRadius;
        switch (this.radiusUnits) {
            case RadiusUnits.ARCMINUTES:
                radius = radius * 60;
                break;
            case RadiusUnits.DEGREES:
                radius = radius * 3600;
                break;
            default:
                break;
        }
        return Number(radius.toPrecision(6));
    }

    // SIMBAD radius range 0 - 90 degrees
    @computed get maxRadius(): number {
        switch (this.radiusUnits) {
            case RadiusUnits.ARCMINUTES:
                return 90 * 60;
            case RadiusUnits.ARCSECONDS:
                return 90 * 3600;
            default:
                return 90;
        }
    }

    @computed get disableObjectSearch(): boolean {
        return this.objectName === "";
    }

    @computed get searchRadiusInDegree(): number {
        const activeFrame = this.activeFrame;
        if (activeFrame) {
            const requiredFrameView = activeFrame.requiredFrameView;
            const diagonal1 = this.calculateDistanceFromPixelCoord({x: requiredFrameView.xMax, y: requiredFrameView.yMax}, {x: requiredFrameView.xMin, y: requiredFrameView.yMin}, true);
            const diagonal2 = this.calculateDistanceFromPixelCoord({x: requiredFrameView.xMin, y: requiredFrameView.yMax}, {x: requiredFrameView.xMax, y: requiredFrameView.yMin}, true);
            const diagonal3 = this.calculateDistanceFromPixelCoord({x: requiredFrameView.xMax, y: requiredFrameView.yMax}, {x: requiredFrameView.xMin, y: requiredFrameView.yMin}, false);
            const diagonal = Math.max(diagonal1, diagonal2, diagonal3);
            if (isNaN(diagonal)) {
                return 90;
            }
            return clamp(diagonal / 2, 0, 90);
        }
        return 90;
    }

    @computed get centerPixelCoordAsPoint2D(): Point2D {
        return {
            x: Number(this.centerPixelCoord.x),
            y: Number(this.centerPixelCoord.y)
        };
    }

    @computed get activeFrame() {
        return AppStore.Instance?.activeFrame?.spatialReference ?? AppStore.Instance.activeFrame;
    }

    @computed get showVizierResult(): boolean {
        return this.vizierResource.size !== 0 && this.catalogDB === CatalogDatabase.VIZIER;
    }

    @computed get selectedVizierSource(): VizieResource[] {
        const resources = [];
        this.vizierSelectedTableName.forEach(table => resources.push(this.vizierResource.get(table.name)));
        return resources;
    }

    @computed get enableLoadVizieR(): boolean {
        return this.vizierSelectedTableName.length > 0 && this.showVizierResult;
    }

    @computed get vizierTable(): VizieRItem[] {
        const tables: VizieRItem[] = [];
        this.vizierResource.forEach(resource => {
            tables.push({
                name: resource.table.name,
                description: resource.description
            });
        });
        return tables;
    }

    convertToDeg(pixelCoords: Point2D, system?: SystemType): {x: string; y: string} {
        const frame = this.activeFrame;
        const overlay = OverlayStore.Instance;
        let p: {x: string; y: string} = {x: undefined, y: undefined};
        if (frame && overlay) {
            const precision = overlay.numbers.customPrecision ? overlay.numbers.precision : "*";
            const format = `${NumberFormatType.Degrees}.${precision}`;
            const wcsCopy = AST.copy(frame.wcsInfo);
            let astString = new ASTSettingsString();
            const sys = system ? system : overlay.global.explicitSystem ? overlay.global.explicitSystem : SystemType.ICRS;
            AST.set(wcsCopy, `System=${sys}`);
            astString.add("Format(1)", format);
            astString.add("Format(2)", format);
            const pointWCS = transformPoint(wcsCopy, pixelCoords);
            const normVals = AST.normalizeCoordinates(wcsCopy, pointWCS.x, pointWCS.y);
            p = AST.getFormattedCoordinates(wcsCopy, normVals.x, normVals.y, astString.toString(), true);
            AST.deleteObject(wcsCopy);
        }
        return p;
    }

    convertToPixel(coords: Point2D): Point2D {
        const frame = this.activeFrame;
        const overlay = OverlayStore.Instance;
        let p: {x: number; y: number} = {x: undefined, y: undefined};
        if (frame && overlay) {
            const precision = overlay.numbers.customPrecision ? overlay.numbers.precision : "*";
            const format = `${NumberFormatType.Degrees}.${precision}`;
            const wcsCopy = AST.copy(frame.wcsInfo);
            AST.set(wcsCopy, `System=${SystemType.ICRS}`);
            AST.set(wcsCopy, `Format(1)=${format}`);
            AST.set(wcsCopy, `Format(2)=${format}`);
            p = getPixelValueFromWCS(wcsCopy, {x: coords.x.toString(), y: coords.y.toString()});
            AST.deleteObject(wcsCopy);
        }
        return p;
    }

    private calculateDistanceFromPixelCoord(x: Point2D, y: Point2D, diagonal: boolean): number {
        const max = this.convertToDeg(x);
        const min = this.convertToDeg(y);
        const xd = Number(max.x) - Number(min.x);
        const yd = Number(max.y) - Number(min.y);
        if (diagonal) {
            return Math.sqrt(xd * xd + yd * yd);
        } else {
            return Math.abs(xd) > Math.abs(yd) ? Math.abs(xd) : Math.abs(yd);
        }
    }
}
