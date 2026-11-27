import * as AST from "ast_wrapper";
import {action, computed, makeObservable, observable, reaction} from "mobx";

import {CatalogDatabase, CatalogSystemType, NumberFormatType, RadiusUnits, SystemType} from "enums";
import {type Point2D, type WorkspaceOnlineCatalogQuery} from "models";
import {AppStore, CatalogOnlineQueryStore} from "stores";
import {ASTSettingsString, clamp, convertRadius, getPixelValueFromWCS, RADIUS_UNITS_PER_DEGREE, setAstSystem, transformPoint, type VizierResource} from "utilities";

export type VizierItem = {name: string | null; description: string | null};

export class CatalogOnlineQueryConfigStore {
    private static staticInstance: CatalogOnlineQueryConfigStore;
    public static readonly MIN_OBJECTS = 1;
    public static readonly MAX_OBJECTS = 10000000;
    public static readonly OBJECT_SIZE = 1000;
    public static readonly QUERY_DEG_PRECISION = "10";

    @observable catalogDB: CatalogDatabase = CatalogDatabase.SIMBAD;
    @observable searchRadius: number = 1;
    @observable coordsType: CatalogSystemType = CatalogSystemType.ICRS;
    @observable coordsFormat: NumberFormatType = NumberFormatType.Degrees;
    @observable centerPixelCoord: {x: string | undefined; y: string | undefined} = {x: undefined, y: undefined};
    @observable maxObject: number = CatalogOnlineQueryConfigStore.OBJECT_SIZE;
    @observable isPointSelectionEnabled: boolean = false;
    @observable radiusUnits: RadiusUnits = RadiusUnits.DEGREES;
    @observable objectName: string = "";
    @observable isObjectQuerying: boolean = false;
    //Vizier
    @observable vizierResource: Map<string, VizierResource> = new Map();
    @observable vizierSelectedTableName: VizierItem[] = [];
    @observable vizierKeyWords: string = "";

    constructor() {
        makeObservable(this);
        this.resetSearchRadius();
        reaction(
            () => AppStore.Instance.activeFrame,
            () => {
                this.resetSearchRadius();
            }
        );
        reaction(
            () => AppStore.Instance.isCursorFrozen,
            isCursorFrozen => {
                const frame = this.activeFrame;
                if (isCursorFrozen && frame?.cursorInfo?.posImageSpace) {
                    this.updateCenterPixelCoord(frame.cursorInfo.posImageSpace);
                    this.resetObjectName();
                }
            }
        );
    }

    public static get Instance() {
        if (!CatalogOnlineQueryConfigStore.staticInstance) {
            CatalogOnlineQueryConfigStore.staticInstance = new CatalogOnlineQueryConfigStore();
        }
        return CatalogOnlineQueryConfigStore.staticInstance;
    }

    /** Returns the fields of the dialog, and the list of VizieR tables, that a workspace saves. */
    public toWorkspaceConfig = (): WorkspaceOnlineCatalogQuery => ({
        ...this.workspaceVizierList,
        database: this.catalogDB,
        center: {x: this.centerPixelCoord.x, y: this.centerPixelCoord.y},
        coordinateSystem: this.coordsType,
        coordinateFormat: this.coordsFormat,
        radius: this.searchRadius,
        radiusUnits: this.radiusUnits,
        maxObjects: this.maxObject,
        objectName: this.objectName,
        vizierKeywords: this.vizierKeyWords
    });

    /** Returns the list of VizieR tables and the selected tables, or nothing when no list is shown. */
    private get workspaceVizierList(): Pick<WorkspaceOnlineCatalogQuery, "vizierTables" | "vizierSelectedTables"> {
        const tables = this.vizierTable.filter((table): table is {name: string; description: string | null} => typeof table.name === "string");
        if (!tables.length) {
            return {};
        }
        return {
            vizierTables: tables.map(table => ({name: table.name, description: table.description ?? ""})),
            vizierSelectedTables: this.vizierSelectedTableName.map(table => table.name).filter((name): name is string => typeof name === "string")
        };
    }

    /**
     * Shows a list of VizieR tables that a workspace saved, and selects the saved tables. A workspace
     * without a list clears the list. The list has only the names and the descriptions. Loading a table queries VizieR for it by its name, so
     * the list needs no other data.
     */
    @action private applyWorkspaceVizierList(config: WorkspaceOnlineCatalogQuery) {
        const tables = Array.isArray(config.vizierTables) ? config.vizierTables.filter(table => typeof table?.name === "string" && table.name) : [];
        if (!tables.length) {
            this.resetVizier();
            return;
        }
        const resources = new Map<string, VizierResource>();
        for (const table of tables) {
            const description = typeof table.description === "string" ? table.description : null;
            resources.set(table.name, {
                id: null,
                name: null,
                description,
                coosys: {system: CatalogSystemType.FK5, equinox: "J2000"},
                // The table data is fetched again when the table is loaded.
                table: {name: table.name, description: null, tableElement: document.createElement("TABLE")}
            });
        }
        this.setVizierQueryResult(resources);
        this.resetVizierSelectedTable();
        const selected = Array.isArray(config.vizierSelectedTables) ? config.vizierSelectedTables : [];
        selected.filter(name => typeof name === "string" && resources.has(name)).forEach(name => this.updateVizierSelectedTable({name, description: resources.get(name)?.description ?? null}));
    }

    /**
     * Applies the fields that a workspace saved. A value that is not valid keeps the value of the
     * session. Apply them after the image in front is chosen and the cursor is frozen. Both of these
     * move the center of the dialog.
     */
    @action applyWorkspaceConfig = (config: WorkspaceOnlineCatalogQuery): void => {
        const isNumberString = (value: unknown): value is string => typeof value === "string" && value.trim() !== "" && isFinite(Number(value));
        if (Object.values(CatalogDatabase).includes(config.database)) {
            this.setCatalogDB(config.database);
        }
        if (Object.values(CatalogSystemType).includes(config.coordinateSystem)) {
            this.setCoordsType(config.coordinateSystem);
        }
        if (Object.values(NumberFormatType).includes(config.coordinateFormat)) {
            this.setCoordsFormat(config.coordinateFormat);
        }
        if (Object.values(RadiusUnits).includes(config.radiusUnits)) {
            this.radiusUnits = config.radiusUnits;
        }
        if (typeof config.radius === "number" && isFinite(config.radius) && config.radius > 0) {
            this.setSearchRadius(config.radius);
        }
        if (isNumberString(config.center?.x) && isNumberString(config.center?.y)) {
            this.updateCenterPixelCoord({x: Number(config.center.x), y: Number(config.center.y)});
        }
        const maxObjects = config.maxObjects;
        if (typeof maxObjects === "number" && Number.isInteger(maxObjects) && maxObjects >= CatalogOnlineQueryConfigStore.MIN_OBJECTS && maxObjects <= CatalogOnlineQueryConfigStore.MAX_OBJECTS) {
            this.setMaxObjects(maxObjects);
        }
        if (typeof config.objectName === "string") {
            this.setObjectName(config.objectName);
        }
        if (typeof config.vizierKeywords === "string") {
            this.setVizierKeyWords(config.vizierKeywords);
        }
        this.applyWorkspaceVizierList(config);
        // The dialog says how many objects or tables the last query of the session found. A
        // workspace does not keep that query, so clear the count.
        CatalogOnlineQueryStore.Instance.resetResultSize();
    };

    /** Sets the fields back to the defaults, as for a workspace that saved none. The center and the radius come from the image in front. */
    @action resetWorkspaceConfig = (): void => {
        this.setCatalogDB(CatalogDatabase.SIMBAD);
        this.setCoordsType(CatalogSystemType.ICRS);
        this.setCoordsFormat(NumberFormatType.Degrees);
        this.radiusUnits = RadiusUnits.DEGREES;
        this.resetSearchRadius();
        this.setFrameCenter();
        this.setMaxObjects(CatalogOnlineQueryConfigStore.OBJECT_SIZE);
        this.setObjectName("");
        this.setVizierKeyWords("");
        this.resetVizier();
        CatalogOnlineQueryStore.Instance.resetResultSize();
    };

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

    @action setVizierQueryResult(resources: Map<string, VizierResource>) {
        this.vizierResource = resources;
    }

    @action updateVizierSelectedTable(table: VizierItem) {
        if (!this.vizierSelectedTableName.some(selected => selected.name === table.name)) {
            this.vizierSelectedTableName.push(table);
        }
    }

    @action toggleVizierSelectedTable(table: VizierItem) {
        if (this.vizierSelectedTableName.some(selected => selected.name === table.name)) {
            this.vizierSelectedTableName = this.vizierSelectedTableName.filter(selected => selected.name !== table.name);
        } else {
            this.updateVizierSelectedTable(table);
        }
    }

    @action removeVizierSelectedTable(table: string) {
        this.vizierSelectedTableName = this.vizierSelectedTableName.filter(element => table !== element.name);
    }

    @action resetVizierSelectedTable() {
        this.vizierSelectedTableName = [];
    }

    @action resetVizier() {
        this.vizierResource.clear();
        this.resetVizierSelectedTable();
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
        this.isPointSelectionEnabled = !this.isPointSelectionEnabled;
    }

    @action setRadiusUnits(units: RadiusUnits) {
        this.setSearchRadius(convertRadius(this.searchRadius, this.radiusUnits, units));
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
        this.setSearchRadius(this.searchRadiusInDegree * RADIUS_UNITS_PER_DEGREE[this.radiusUnits]);
        this.setFrameCenter();
    }

    // SIMBAD radius range 0 - 90 degrees
    @computed get maxRadius(): number {
        return 90 * RADIUS_UNITS_PER_DEGREE[this.radiusUnits];
    }

    @computed get isObjectSearchDisabled(): boolean {
        return this.objectName === "";
    }

    @computed get searchRadiusInDegree(): number {
        const activeFrame = this.activeFrame;
        if (activeFrame?.isValidWcs && AppStore.Instance.overlaySettings.isWcsCoordinates) {
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

    @computed get shouldShowVizierResult(): boolean {
        return this.vizierResource.size !== 0 && this.catalogDB === CatalogDatabase.VIZIER;
    }

    @computed get selectedVizierSource(): (VizierResource | undefined)[] {
        const resources: (VizierResource | undefined)[] = [];
        this.vizierSelectedTableName.forEach(table => resources.push(table.name === null ? undefined : this.vizierResource.get(table.name)));
        return resources;
    }

    @computed get canLoadVizier(): boolean {
        return this.vizierSelectedTableName.length > 0 && this.shouldShowVizierResult;
    }

    @computed get vizierTable(): VizierItem[] {
        const tables: VizierItem[] = [];
        this.vizierResource.forEach(resource => {
            tables.push({
                name: resource.table.name,
                description: resource.description
            });
        });
        return tables;
    }

    private isValidPrecisionString(precision: string): boolean {
        return precision === "*" || /^[0-9]+$/.test(precision);
    }

    private getEffectivePrecision(precision?: string): string {
        if (precision && !this.isValidPrecisionString(precision)) {
            console.warn(`Invalid precision string: ${precision}. Expected '*' or a non-negative integer. Using default precision *.`);
        }
        const overlay = AppStore.Instance.overlaySettings;
        return precision ?? (overlay.numbers.hasCustomPrecision ? overlay.numbers.precision.toString() : "*");
    }

    convertToDeg(pixelCoords: Point2D, system?: SystemType, precision?: string): {x: string | undefined; y: string | undefined} {
        const frame = this.activeFrame;
        const overlay = AppStore.Instance.overlaySettings;
        let p: {x: string | undefined; y: string | undefined} = {x: undefined, y: undefined};
        if (frame && overlay) {
            const format = `${NumberFormatType.Degrees}.${this.getEffectivePrecision(precision)}`;
            const wcsCopy = AST.copy(frame.wcsInfo);
            const astString = new ASTSettingsString();
            const sys = system ? system : overlay.global.explicitSystem ? overlay.global.explicitSystem : SystemType.ICRS;
            if (frame.isXY || frame.isYX) {
                setAstSystem(wcsCopy, sys, overlay.global);
                astString.add(`Format(${frame.dirX})`, format);
                astString.add(`Format(${frame.dirY})`, format);
            }
            const pointWCS = transformPoint(wcsCopy, pixelCoords);
            const normVals = AST.normalizeCoordinates(wcsCopy, pointWCS.x, pointWCS.y);
            p = AST.getFormattedCoordinates(wcsCopy, normVals.x, normVals.y, astString.toString(), true);
            AST.deleteObject(wcsCopy);
        }
        return p;
    }

    convertToPixel(coords: Point2D, precision?: string): {x: number | undefined; y: number | undefined} | null {
        const frame = this.activeFrame;
        const overlay = AppStore.Instance.overlaySettings;
        let p: {x: number | undefined; y: number | undefined} | null = {x: undefined, y: undefined};
        if (frame && overlay) {
            const effectivePrecision = this.getEffectivePrecision(precision);
            const format = `${NumberFormatType.Degrees}.${effectivePrecision}`;
            const wcsCopy = AST.copy(frame.wcsInfo);
            if (frame.isXY || frame.isYX) {
                AST.set(wcsCopy, `System=${SystemType.ICRS}`);
                AST.set(wcsCopy, `Format(${frame.dirX})=${format}`);
                AST.set(wcsCopy, `Format(${frame.dirY})=${format}`);
            }
            p = getPixelValueFromWCS(wcsCopy, {x: coords.x.toString(), y: coords.y.toString()});
            AST.deleteObject(wcsCopy);
        }
        return p;
    }

    private calculateDistanceFromPixelCoord(x: Point2D, y: Point2D, isDiagonal: boolean): number {
        const max = this.convertToDeg(x);
        const min = this.convertToDeg(y);
        const xd = Number(max.x) - Number(min.x);
        const yd = Number(max.y) - Number(min.y);
        if (isDiagonal) {
            return Math.sqrt(xd * xd + yd * yd);
        } else {
            return Math.abs(xd) > Math.abs(yd) ? Math.abs(xd) : Math.abs(yd);
        }
    }
}
