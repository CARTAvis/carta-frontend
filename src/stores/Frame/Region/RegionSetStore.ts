import type * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";
import {action, computed, makeObservable, observable, runInAction} from "mobx";

import {RegionMode, RegionOpacity} from "enums";
import {type Point2D, Transform2D} from "models";
import {type BackendService} from "services";
import {FileBrowserStore, type PreferenceStore} from "stores";
import {CompassAnnotationStore, CURSOR_REGION_ID, type FrameStore, PointAnnotationStore, RulerAnnotationStore, TextAnnotationStore, VectorAnnotationStore} from "stores/Frame";
import {getNextRegionOpacity, isAstBadPoint, scale2D, transformPoint} from "utilities";

import {RegionStore} from "./RegionStore";

type AdjacentRegionOptions = {
    wrap?: boolean;
    range?: boolean;
    includeCursor?: boolean;
    selectedOnly?: boolean;
    preserveSelection?: boolean;
};

export class RegionSetStore {
    @observable regions: RegionStore[] = [];
    @observable focusedRegion: RegionStore | null;
    @observable selectedRegionIds: Set<number> = new Set();
    @observable mode: RegionMode = RegionMode.MOVING;
    @observable newRegionType: CARTA.RegionType;
    @observable isLocked: boolean = false;
    @observable isHoverImage: Boolean = false;

    private readonly frame: FrameStore;
    private readonly backendService: BackendService;
    private readonly preference: PreferenceStore;
    private activeRegionDragTargets: RegionStore[] | null = null;
    private selectionPivotRegionId: number | null = null;
    private keyboardRangeAnchorRegionId: number | null = null;
    private keyboardRangeDisplacement: number = 0;
    private keyboardRangeBaseSelection: Set<number> = new Set();

    constructor(frame: FrameStore, preference: PreferenceStore, backendService: BackendService) {
        this.frame = frame;
        this.backendService = backendService;
        this.preference = preference;
        this.newRegionType = preference.regionType;
        this.addPointRegion(frame.center, true);
        this.focusedRegion = this.regions[0] ?? null;
        makeObservable(this);
    }

    @computed get selectedRegionCount(): number {
        return this.selectedRegionIds.size;
    }

    @computed get selectedRegionsList(): RegionStore[] {
        return Array.from(this.selectedRegionIds).map(id => this.regionMap.get(id)!);
    }

    @computed get editableRegionsList(): RegionStore[] {
        return this.regions.filter(region => !region.isTemporary && region.regionId !== CURSOR_REGION_ID);
    }

    @computed get visibleEditableRegionsList(): RegionStore[] {
        return this.editableRegionsList.filter(region => region.isVisible);
    }

    @computed get isAllSelectedRegionsLocked(): boolean {
        const selectedRegions = this.selectedRegionsList.filter(region => region.isVisible);
        return selectedRegions.length > 0 && selectedRegions.every(region => region.isLocked);
    }

    @computed get selectedRegionsOpacity(): RegionOpacity {
        return this.getRegionsOpacity(this.selectedRegionsList);
    }

    @computed get editableRegionsOpacity(): RegionOpacity {
        return this.getRegionsOpacity(this.editableRegionsList);
    }

    @computed get isAllEditableRegionsLocked(): boolean {
        const editableRegions = this.visibleEditableRegionsList;
        return editableRegions.length > 0 && editableRegions.every(region => region.isLocked);
    }

    private getRegionsOpacity = (regions: RegionStore[]): RegionOpacity => {
        if (!regions.length || regions.every(region => region.opacity === RegionOpacity.Invisible)) {
            return RegionOpacity.Invisible;
        }
        if (regions.every(region => region.opacity === RegionOpacity.SemiTransparent)) {
            return RegionOpacity.SemiTransparent;
        }
        return RegionOpacity.Visible;
    };

    isRegionInMultiSelection = (region: RegionStore | null | undefined): boolean => {
        return !!region && this.selectedRegionCount > 1 && this.selectedRegionIds.has(region.regionId);
    };

    @action clearSelection = () => {
        this.selectedRegionIds = new Set();
        this.focusedRegion = this.cursorRegion;
        this.resetSelectionRangeState();
    };

    @action setSelectionByIds = (ids: number[], focusRegionId?: number) => {
        const regionMap = this.regionMap;
        const newSet = new Set<number>();
        for (const id of ids) {
            if (id !== CURSOR_REGION_ID && regionMap.has(id)) {
                newSet.add(id);
            }
        }
        this.selectedRegionIds = newSet;

        const selectedIds = Array.from(newSet);
        if (selectedIds.length === 0) {
            this.focusedRegion = this.cursorRegion;
            return;
        }
        if (selectedIds.length > 1) {
            this.deselectPointsInSelection(newSet);
        }

        const focusRegion = focusRegionId !== undefined && newSet.has(focusRegionId) ? regionMap.get(focusRegionId) : regionMap.get(selectedIds[selectedIds.length - 1]);
        if (focusRegion) {
            this.setFocusedRegion(focusRegion);
            this.selectionPivotRegionId = focusRegion.regionId;
        }
    };

    @action selectSingleRegion = (region: RegionStore) => {
        if (!region || region.regionId === CURSOR_REGION_ID) {
            this.clearSelection();
            return;
        }
        this.selectedRegionIds = new Set([region.regionId]);
        if (region.isPointSelectionSupported) {
            region.deselectPoint();
        }
        this.setFocusedRegion(region);
        this.selectionPivotRegionId = region.regionId;
        this.resetKeyboardRangeState();
    };

    @action replaceRegionId = (previousRegionId: number, regionId: number) => {
        if (previousRegionId === regionId) {
            return;
        }

        if (this.selectedRegionIds.has(previousRegionId)) {
            const selectedIds = new Set(this.selectedRegionIds);
            selectedIds.delete(previousRegionId);
            selectedIds.add(regionId);
            this.selectedRegionIds = selectedIds;
        }

        if (this.selectionPivotRegionId === previousRegionId) {
            this.selectionPivotRegionId = regionId;
        }

        if (this.keyboardRangeAnchorRegionId === previousRegionId) {
            this.keyboardRangeAnchorRegionId = regionId;
        }

        if (this.keyboardRangeBaseSelection.has(previousRegionId)) {
            const selectedIds = new Set(this.keyboardRangeBaseSelection);
            selectedIds.delete(previousRegionId);
            selectedIds.add(regionId);
            this.keyboardRangeBaseSelection = selectedIds;
        }
    };

    @action toggleRegionSelection = (region: RegionStore) => {
        if (!region || region.regionId === CURSOR_REGION_ID) {
            this.clearSelection();
            return;
        }

        const selectedIds = new Set(this.selectedRegionIds);
        if (selectedIds.has(region.regionId)) {
            selectedIds.delete(region.regionId);
        } else {
            selectedIds.add(region.regionId);
        }

        const ids = Array.from(selectedIds);
        this.setSelectionByIds(ids, selectedIds.has(region.regionId) ? region.regionId : undefined);
        this.resetKeyboardRangeState();
    };

    @action applyRegionBoxSelection = (regionIds: number[]) => {
        const regionMap = this.regionMap;
        const boxSelectionIds = Array.from(new Set(regionIds.filter(id => id !== CURSOR_REGION_ID && regionMap.has(id))));
        if (!boxSelectionIds.length) {
            return;
        }

        const selectedIds = new Set(this.selectedRegionIds);
        const hasSelectedRegion = boxSelectionIds.some(id => selectedIds.has(id));
        const hasUnselectedRegion = boxSelectionIds.some(id => !selectedIds.has(id));

        if (hasSelectedRegion && hasUnselectedRegion) {
            boxSelectionIds.forEach(id => selectedIds.add(id));
        } else {
            boxSelectionIds.forEach(id => {
                if (selectedIds.has(id)) {
                    selectedIds.delete(id);
                } else {
                    selectedIds.add(id);
                }
            });
        }

        const ids = Array.from(selectedIds);
        this.setSelectionByIds(ids, boxSelectionIds[boxSelectionIds.length - 1] ?? ids[ids.length - 1]);
        this.resetKeyboardRangeState();
    };

    @action selectAllRegions = () => {
        const selectableRegions = this.editableRegionsList;
        if (!selectableRegions.length) {
            return;
        }

        const focusedRegionId = this.focusedRegion?.regionId;
        const focusRegionId = focusedRegionId && selectableRegions.some(region => region.regionId === focusedRegionId) ? focusedRegionId : selectableRegions[selectableRegions.length - 1].regionId;
        this.setSelectionByIds(
            selectableRegions.map(region => region.regionId),
            focusRegionId
        );
        this.selectionPivotRegionId = focusRegionId;
        this.resetKeyboardRangeState();
    };

    @action selectRegionFromList = (region: RegionStore, regions: RegionStore[], options: {toggle?: boolean; range?: boolean} = {}) => {
        if (!region || region.regionId === CURSOR_REGION_ID) {
            this.clearSelection();
            return;
        }

        const hasSelection = this.selectedRegionCount > 0;
        const regionIndex = regions.findIndex(candidate => candidate.regionId === region.regionId);
        const pivotIndex = this.selectionPivotRegionId !== null ? regions.findIndex(candidate => candidate.regionId === this.selectionPivotRegionId) : -1;

        if (options.toggle && hasSelection) {
            this.toggleRegionSelection(region);
            return;
        }

        if (options.range && hasSelection && pivotIndex >= 0 && regionIndex >= 0) {
            this.setSelectionRange(regions, pivotIndex, regionIndex, region.regionId);
            this.resetKeyboardRangeState();
            return;
        }

        if (this.isRegionInMultiSelection(region)) {
            this.setFocusedRegion(region);
            this.selectionPivotRegionId = region.regionId;
            this.resetKeyboardRangeState();
            return;
        }

        this.selectSingleRegion(region);
    };

    @action selectAdjacentRegionFromList = (regions: RegionStore[], direction: 1 | -1, options: Pick<AdjacentRegionOptions, "wrap" | "range" | "includeCursor"> = {}) => {
        this.selectAdjacentRegion(regions, direction, options);
    };

    private selectAdjacentRegion = (regions: RegionStore[], direction: 1 | -1, options: AdjacentRegionOptions = {}) => {
        let list = options.includeCursor ? regions : this.getSelectableRegions(regions);
        if (options.selectedOnly) {
            list = list.filter(region => this.selectedRegionIds.has(region.regionId));
        }
        if (!list.length) {
            return;
        }

        const focusedId = this.focusedRegion?.regionId ?? -1;
        const focusedIndex = list.findIndex(region => region.regionId === focusedId);

        if (options.range) {
            this.extendKeyboardSelectionRange(list, focusedIndex, direction);
            return;
        }

        const startIndex = focusedIndex >= 0 ? focusedIndex : direction > 0 ? -1 : list.length;
        const nextIndex = options.wrap ? this.wrapIndex(startIndex + direction, list.length) : this.clampIndex(startIndex + direction, list.length);
        const region = list[nextIndex];
        if (!region) {
            return;
        }

        if (options.preserveSelection) {
            this.setFocusedRegion(region);
            this.selectionPivotRegionId = region.regionId;
            this.resetKeyboardRangeState();
        } else {
            this.selectSingleRegion(region);
        }
        region.deselectPoint();
    };

    private getSelectableRegions = (regions: RegionStore[]): RegionStore[] => {
        return regions.filter(region => region.regionId !== CURSOR_REGION_ID);
    };

    private setSelectionRange = (regions: RegionStore[], startIndex: number, endIndex: number, focusRegionId: number) => {
        const start = Math.min(startIndex, endIndex);
        const end = Math.max(startIndex, endIndex);
        const ids: number[] = [];
        for (let i = start; i <= end; i++) {
            const region = regions[i];
            if (region && region.regionId !== CURSOR_REGION_ID) {
                ids.push(region.regionId);
            }
        }
        this.setSelectionByIds(ids, focusRegionId);
    };

    private extendKeyboardSelectionRange = (regions: RegionStore[], focusedIndex: number, direction: 1 | -1) => {
        const n = regions.length;
        let anchorIndex = this.keyboardRangeAnchorRegionId !== null ? regions.findIndex(region => region.regionId === this.keyboardRangeAnchorRegionId) : -1;
        if (anchorIndex >= 0 && focusedIndex !== this.wrapIndex(anchorIndex + this.keyboardRangeDisplacement, n)) {
            anchorIndex = -1;
        }

        let displacement: number;
        if (anchorIndex < 0) {
            anchorIndex = focusedIndex >= 0 ? focusedIndex : direction > 0 ? 0 : n - 1;
            this.keyboardRangeAnchorRegionId = regions[anchorIndex].regionId;
            this.keyboardRangeBaseSelection = new Set(this.selectedRegionIds);
            this.selectionPivotRegionId = regions[anchorIndex].regionId;
            displacement = direction;
        } else {
            displacement = this.keyboardRangeDisplacement + direction;
        }

        displacement = Math.max(-(n - 1), Math.min(n - 1, displacement));
        this.keyboardRangeDisplacement = displacement;

        const selectedIds = new Set<number>(this.keyboardRangeBaseSelection);
        const sign = displacement >= 0 ? 1 : -1;
        const steps = Math.abs(displacement);
        for (let i = 0; i <= steps; i++) {
            selectedIds.add(regions[this.wrapIndex(anchorIndex + sign * i, n)].regionId);
        }

        const focusRegionId = regions[this.wrapIndex(anchorIndex + displacement, n)].regionId;
        this.setSelectionByIds(Array.from(selectedIds), focusRegionId);
    };

    private resetSelectionRangeState = () => {
        this.selectionPivotRegionId = null;
        this.resetKeyboardRangeState();
    };

    private resetKeyboardRangeState = () => {
        this.keyboardRangeAnchorRegionId = null;
        this.keyboardRangeDisplacement = 0;
        this.keyboardRangeBaseSelection = new Set();
    };

    private wrapIndex = (value: number, length: number): number => {
        return ((value % length) + length) % length;
    };

    private clampIndex = (value: number, length: number): number => {
        return Math.max(0, Math.min(length - 1, value));
    };

    private getRegionDragTargets = (origin: RegionStore): RegionStore[] => {
        if (!origin || origin.regionId === CURSOR_REGION_ID) {
            return [];
        }

        const selectedRegions = this.selectedRegionIds.has(origin.regionId) ? this.selectedRegionsList : [origin];

        return selectedRegions.filter(region => region.isVisible && !region.isLocked);
    };

    @action beginRegionDrag = (origin: RegionStore) => {
        if (!this.selectedRegionIds.has(origin.regionId)) {
            this.selectSingleRegion(origin);
        } else {
            this.setFocusedRegion(origin);
        }

        this.activeRegionDragTargets = this.getRegionDragTargets(origin);
        for (const region of this.activeRegionDragTargets) {
            region.beginEditing();
        }
    };

    @action endRegionDrag = (origin: RegionStore) => {
        const activeRegionDragTargets = this.activeRegionDragTargets ?? this.getRegionDragTargets(origin);
        for (const region of activeRegionDragTargets) {
            region.endEditing();
        }
        this.activeRegionDragTargets = null;
    };

    @action translateRegionDrag = (origin: RegionStore, delta: Point2D) => {
        const activeRegionDragTargets = this.activeRegionDragTargets ?? this.getRegionDragTargets(origin);
        for (const region of activeRegionDragTargets) {
            region.translate(delta);
        }
    };

    public updateCursorRegionPosition = (pos: Point2D) => {
        if (pos && this.regions.length > 0) {
            const cursorRegion = this.regions[0];
            // Need to avoid redundant update (position not changed), backend may not reply to redundant requests.
            const roundedPos = {x: Math.round(pos.x), y: Math.round(pos.y)};
            if (cursorRegion?.regionId === CURSOR_REGION_ID && (!this.isHoverImage || cursorRegion.center?.x !== roundedPos.x || cursorRegion.center?.y !== roundedPos.y)) {
                cursorRegion.setCenter(roundedPos);
                this.setIsHover(true);
            }
        }
    };

    @action setIsHover = (isHover: boolean) => {
        this.isHoverImage = isHover;
    };

    // temporary region IDs are < 0 and used
    public getTempRegionId = () => {
        let regionId = -1;
        if (this.regions.length) {
            const minRegionId = Math.min(...this.regions.map(r => r.regionId));
            regionId = Math.min(regionId, minRegionId - 1);
        }
        return regionId;
    };

    /**
     * Returns an array of region IDs and types in the region set.
     */
    @computed get regionList(): {id: number; type: CARTA.RegionType}[] {
        return this.regions.map(r => {
            return {id: r.regionId, type: r.regionType};
        });
    }

    /**
     * Returns a map associating region IDs with their corresponding RegionStore instances.
     */
    @computed get regionMap(): Map<number, RegionStore> {
        const regionMap = new Map<number, RegionStore>();

        for (const region of this.regions) {
            regionMap.set(region.regionId, region);
        }

        return regionMap;
    }

    @computed private get cursorRegion(): RegionStore | null {
        return this.regions.find(region => region.regionId === CURSOR_REGION_ID) ?? null;
    }

    @computed get regionsAndAnnotationsForRender(): RegionStore[] {
        return this.regions?.filter(r => r.isValid && r.regionId !== CURSOR_REGION_ID)?.sort((a, b) => (a.boundingBoxArea > b.boundingBoxArea ? -1 : 1));
    }

    @computed get isNewRegionAnnotation(): boolean {
        return RegionStore.AVAILABLE_ANNOTATION_TYPES.has(this.newRegionType);
    }

    @action addPointRegion = (center: Point2D, isCursorRegion = false) => {
        return this.addRegion([center], 0, CARTA.RegionType.POINT, isCursorRegion, isCursorRegion ? CURSOR_REGION_ID : this.getTempRegionId());
    };

    @action addRectangularRegion = (center: Point2D, width: number, height: number, isTemporary: boolean = false) => {
        return this.addRegion([center, {x: width, y: height}], 0, CARTA.RegionType.RECTANGLE, isTemporary);
    };

    @action addEllipticalRegion = (center: Point2D, semiMajor: number, semiMinor: number, isTemporary: boolean = false) => {
        return this.addRegion([center, {x: semiMinor, y: semiMajor}], 0, CARTA.RegionType.ELLIPSE, isTemporary);
    };

    @action addPolygonalRegion = (points: Point2D[], isTemporary: boolean = false) => {
        return this.addRegion(points, 0, CARTA.RegionType.POLYGON, isTemporary);
    };

    @action addLineRegion = (points: Point2D[], isTemporary: boolean = false) => {
        return this.addRegion(points, 0, CARTA.RegionType.LINE, isTemporary);
    };

    @action addPolylineRegion = (points: Point2D[], isTemporary: boolean = false) => {
        return this.addRegion(points, 0, CARTA.RegionType.POLYLINE, isTemporary);
    };
    @action addAnnPointRegion = (center: Point2D, shape?: CARTA.PointAnnotationShape, isCursorRegion = false) => {
        return this.addRegion([center], 0, CARTA.RegionType.ANNPOINT, isCursorRegion, this.getTempRegionId(), "", shape);
    };

    @action addAnnRectangularRegion = (center: Point2D, width: number, height: number, isTemporary: boolean = false) => {
        return this.addRegion([center, {x: width, y: height}], 0, CARTA.RegionType.ANNRECTANGLE, isTemporary);
    };

    @action addAnnEllipticalRegion = (center: Point2D, semiMajor: number, semiMinor: number, isTemporary: boolean = false) => {
        return this.addRegion([center, {x: semiMinor, y: semiMajor}], 0, CARTA.RegionType.ANNELLIPSE, isTemporary);
    };

    @action addAnnPolygonalRegion = (points: Point2D[], isTemporary: boolean = false) => {
        return this.addRegion(points, 0, CARTA.RegionType.ANNPOLYGON, isTemporary);
    };

    @action addAnnLineRegion = (points: Point2D[], isTemporary: boolean = false) => {
        return this.addRegion(points, 0, CARTA.RegionType.ANNLINE, isTemporary);
    };

    @action addAnnPolylineRegion = (points: Point2D[], isTemporary: boolean = false) => {
        return this.addRegion(points, 0, CARTA.RegionType.ANNPOLYLINE, isTemporary);
    };

    @action addAnnVectorRegion = (points: Point2D[], isTemporary: boolean = false) => {
        return this.addRegion(points, 0, CARTA.RegionType.ANNVECTOR, isTemporary);
    };

    @action addAnnTextRegion = (center: Point2D, width: number, height: number, isTemporary: boolean = false) => {
        return this.addRegion([center, {x: width, y: height}], 0, CARTA.RegionType.ANNTEXT, isTemporary);
    };

    @action addAnnCompassRegion = (point: Point2D, length: number, isTemporary: boolean = false) => {
        return this.addRegion([point, {x: length, y: length}], 0, CARTA.RegionType.ANNCOMPASS, isTemporary);
    };

    @action addAnnRulerRegion = (points: Point2D[], isTemporary: boolean = false) => {
        return this.addRegion(points, 0, CARTA.RegionType.ANNRULER, isTemporary);
    };

    @action addExistingRegion = (points: Point2D[], rotation: number, regionType: CARTA.RegionType, regionId: number, name: string, color: string, lineWidth: number, dashes: number[], isTemporary = true, annotationStyles?: any) => {
        const region = this.addRegion(points, rotation, regionType, isTemporary, regionId, name);
        // additional imported style properties;
        if (color) {
            region.color = color;
        }
        if (lineWidth) {
            region.lineWidth = lineWidth;
        }
        if (dashes?.length) {
            region.dashLength = dashes[0];
        }

        if (annotationStyles) {
            switch (regionType) {
                case CARTA.RegionType.ANNPOINT:
                    (region as PointAnnotationStore).initializeStyles(annotationStyles);
                    break;
                case CARTA.RegionType.ANNTEXT:
                    (region as TextAnnotationStore).initializeStyles(annotationStyles);
                    break;
                case CARTA.RegionType.ANNVECTOR:
                    (region as VectorAnnotationStore).initializeStyles(annotationStyles);
                    break;
                case CARTA.RegionType.ANNCOMPASS:
                    (region as CompassAnnotationStore).initializeStyles(annotationStyles);
                    break;
                case CARTA.RegionType.ANNRULER:
                    (region as RulerAnnotationStore).initializeStyles(annotationStyles);
                    break;
                default:
                    break;
            }
        }

        return region;
    };

    /**
     * Adds a new region and returns the corresponding RegionStore object.
     *
     * @param regionType - Type of the region.
     * @param points - Points defining the shape of the region. For rectangles, ellipses, text annotations, and compass annotations, provide [center, size]; for other types, provide an array of positions.
     * @param rotation - Rotation angle of the region in degrees. Only applicable for rectangles, ellipses, and text annotations.
     * @param regionName - Optional name for the region. If it is not provided or is an empty string, a default name will be applied.
     * @returns A promise that resolves to the RegionStore object representing the added region.
     */
    addRegionAsync = async (regionType: CARTA.RegionType, points: Point2D[], rotation: number = 0, regionName: string = ""): Promise<RegionStore> => {
        const tempRegionId = this.getTempRegionId();
        const region = this.initRegion(points, rotation, regionType, tempRegionId, regionName);
        this.regions.push(region);

        try {
            await this.requestSetRegion(this.frame.frameInfo.fileId, region);
        } catch (err) {
            console.error(err);
        }

        return region;
    };

    private addRegion = (points: Point2D[], rotation: number, regionType: CARTA.RegionType, isTemporary: boolean = false, regionId: number = this.getTempRegionId(), regionName: string = "", pointShape?: CARTA.PointAnnotationShape) => {
        const region = this.initRegion(points, rotation, regionType, regionId, regionName, pointShape);
        this.regions.push(region);

        if (!isTemporary) {
            this.requestSetRegion(this.frame.frameInfo.fileId, region);
        }

        return region;
    };

    private initRegion = (points: Point2D[], rotation: number, regionType: CARTA.RegionType, regionId: number, regionName: string, pointShape?: CARTA.PointAnnotationShape): RegionStore => {
        type CommonInputs = [BackendService, number, FrameStore, Point2D[], CARTA.RegionType, number, number, string];
        type StyleInputs = [string, number, number];
        const commonInputs: CommonInputs = [this.backendService, this.frame.frameInfo.fileId, this.frame, points, regionType, regionId, rotation, regionName];
        const regionStyles: StyleInputs = [this.preference.regionColor, this.preference.regionLineWidth, this.preference.regionDashLength];
        const annotationStyles: StyleInputs = [this.preference.annotationColor, this.preference.annotationLineWidth, this.preference.annotationDashLength];

        switch (regionType) {
            case CARTA.RegionType.ANNCOMPASS:
                return new CompassAnnotationStore(...commonInputs, ...annotationStyles);
            case CARTA.RegionType.ANNRULER:
                return new RulerAnnotationStore(...commonInputs, ...annotationStyles);
            case CARTA.RegionType.ANNTEXT:
                return new TextAnnotationStore(...commonInputs, this.preference.annotationColor, this.preference.textAnnotationLineWidth, this.preference.annotationDashLength);
            case CARTA.RegionType.ANNPOINT: {
                const region = new PointAnnotationStore(...commonInputs, ...annotationStyles);
                region.initializeStyles({pointShape: pointShape ?? this.preference.pointAnnotationShape, pointWidth: this.preference.pointAnnotationWidth});
                return region;
            }
            case CARTA.RegionType.ANNVECTOR:
                return new VectorAnnotationStore(...commonInputs, ...annotationStyles);
            case CARTA.RegionType.ANNELLIPSE:
            case CARTA.RegionType.ANNRECTANGLE:
            case CARTA.RegionType.ANNPOLYGON:
            case CARTA.RegionType.ANNPOLYLINE:
            case CARTA.RegionType.ANNLINE:
                return new RegionStore(...commonInputs, ...annotationStyles);
            default:
                return new RegionStore(...commonInputs, ...regionStyles);
        }
    };

    private requestSetRegion = async (fileId: number, region: RegionStore) => {
        try {
            const ack = await this.backendService.setRegion(fileId, -1, region);
            console.log(`Updating regionID from ${region.regionId} to ${ack.regionId}`);
            if (ack.regionId != null) {
                const regionId = ack.regionId;
                runInAction(() => {
                    region.setRegionId(regionId);
                });
            }
        } catch (err) {
            console.error(err);
        }
    };

    @action setFocusedRegion = (region: RegionStore) => {
        if (this.regions.indexOf(region) >= 0) {
            if (this.focusedRegion && this.focusedRegion !== region && this.focusedRegion.isPointSelectionSupported) {
                this.focusedRegion.deselectPoint();
            }
            if (region.regionId !== CURSOR_REGION_ID && !this.selectedRegionIds.has(region.regionId)) {
                this.selectedRegionIds = new Set([...this.selectedRegionIds, region.regionId]);
                if (this.selectedRegionIds.size > 1) {
                    this.deselectPointsInSelection(this.selectedRegionIds);
                }
            }
            this.focusedRegion = region;
        }
    };

    private deselectPointsInSelection = (selectedIds: Set<number>) => {
        for (const region of this.regions) {
            if (selectedIds.has(region.regionId) && region.isPointSelectionSupported) {
                region.deselectPoint();
            }
        }
    };

    private selectAdjacentRegionFromHotkey = (direction: 1 | -1) => {
        if (this.regions.length <= 1) {
            return;
        }

        const isMultiSelection = this.selectedRegionCount > 1;
        this.selectAdjacentRegion(this.regions, direction, {wrap: true, selectedOnly: isMultiSelection, preserveSelection: isMultiSelection});
    };

    @action selectNextRegion = () => {
        this.selectAdjacentRegionFromHotkey(1);
    };

    @action selectPreviousRegion = () => {
        this.selectAdjacentRegionFromHotkey(-1);
    };

    @action toggleSelectedRegionsVisibility = () => {
        const opacity = getNextRegionOpacity(this.selectedRegionsOpacity);
        this.selectedRegionsList.forEach(region => region.setOpacity(opacity));
    };

    @action toggleSelectedRegionsLocked = () => {
        const visibleSelectedRegions = this.selectedRegionsList.filter(region => region.isVisible);
        const shouldLock = visibleSelectedRegions.length > 0 && !visibleSelectedRegions.every(region => region.isLocked);
        visibleSelectedRegions.forEach(region => region.setLocked(shouldLock));
    };

    @action toggleEditableRegionsLocked = () => {
        const shouldLock = !this.isAllEditableRegionsLocked;
        this.visibleEditableRegionsList.forEach(region => region.setLocked(shouldLock));
    };

    @action setEditableRegionsOpacity = (opacity: RegionOpacity) => {
        this.editableRegionsList.forEach(region => region.setOpacity(opacity));
    };

    @action toggleEditableRegionsVisibility = () => {
        this.setEditableRegionsOpacity(getNextRegionOpacity(this.editableRegionsOpacity));
    };

    @action deleteRegion = (region: RegionStore) => {
        if (region && region.regionId !== CURSOR_REGION_ID && this.regions.length) {
            if (this.selectedRegionIds.has(region.regionId)) {
                const selectedIds = new Set(this.selectedRegionIds);
                selectedIds.delete(region.regionId);
                this.selectedRegionIds = selectedIds;
            }
            if (region === this.focusedRegion) {
                const editableRegions = this.editableRegionsList;
                const deletedIndex = editableRegions.findIndex(candidate => candidate.regionId === region.regionId);
                const remainingRegions = editableRegions.filter(candidate => candidate.regionId !== region.regionId);
                const nextRegionIndex = deletedIndex >= 0 ? Math.min(deletedIndex, remainingRegions.length - 1) : remainingRegions.length - 1;
                const nextFocusedRegion = remainingRegions[nextRegionIndex];
                if (nextFocusedRegion) {
                    this.selectSingleRegion(nextFocusedRegion);
                } else {
                    this.clearSelection();
                }
            }
            const selectedInd = this.regions.findIndex(r => r === region);
            const exportRegionIndexes = FileBrowserStore.Instance.exportRegionIndexes.filter(x => x !== selectedInd).map(x => (x > selectedInd ? x - 1 : x));
            FileBrowserStore.Instance.updateExportRegionIndexes(exportRegionIndexes);
            this.regions = this.regions.filter(r => r !== region);
            if (!region.isTemporary) {
                this.backendService.removeRegion(region.regionId);
            }
        }
    };

    @action setNewRegionType = (type: CARTA.RegionType) => {
        this.newRegionType = type;
    };

    @action setMode = mode => {
        this.mode = mode;
    };

    @action toggleMode = () => {
        this.mode = this.mode === RegionMode.MOVING ? RegionMode.CREATING : RegionMode.MOVING;
    };

    @action migrateRegionsFromExistingSet = (sourceRegionSet: RegionSetStore, spatialTransformAST: AST.Mapping, isForward: boolean = false) => {
        if (sourceRegionSet?.regions?.length <= 1) {
            return;
        }

        const dstRegionTimestamps = this.regions.map(r => r.modifiedTimestamp);
        let newId = -1;
        for (const region of sourceRegionSet.regions) {
            // skip duplicates
            const duplicateRegion = dstRegionTimestamps.find(t => t === region.modifiedTimestamp);
            if (duplicateRegion) {
                continue;
            }

            if (region.regionId === CURSOR_REGION_ID) {
                const centerNewFrame = transformPoint(spatialTransformAST, region.center, isForward);
                if (this.regions.length && this.regions[0].regionId === CURSOR_REGION_ID) {
                    this.regions[0].setCenter(centerNewFrame);
                }
            } else {
                let newControlPoints: Point2D[] = [];
                let rotation: number = 0;

                let annotationStyles;

                switch (region.regionType) {
                    case CARTA.RegionType.ANNELLIPSE:
                    case CARTA.RegionType.ANNTEXT:
                    case CARTA.RegionType.ANNCOMPASS:
                    case CARTA.RegionType.RECTANGLE:
                    case CARTA.RegionType.ANNRECTANGLE:
                    case CARTA.RegionType.ELLIPSE:
                        switch (region.regionType) {
                            case CARTA.RegionType.ANNTEXT:
                                annotationStyles = (region as TextAnnotationStore).getAnnotationStyles();
                                break;
                            case CARTA.RegionType.ANNCOMPASS:
                                annotationStyles = (region as CompassAnnotationStore).getAnnotationStyles();
                                break;
                        }

                        const centerNewFrame = transformPoint(spatialTransformAST, region.center, isForward);
                        if (!isAstBadPoint(centerNewFrame)) {
                            const transform = new Transform2D(spatialTransformAST, centerNewFrame);
                            const size = scale2D(region.size, isForward ? transform.scale : 1.0 / transform.scale);
                            rotation = region.rotation + ((isForward ? 1 : -1) * transform.rotation * 180) / Math.PI;
                            newControlPoints = [centerNewFrame, size];
                        }
                        break;
                    case CARTA.RegionType.POINT:
                    case CARTA.RegionType.POLYGON:
                    case CARTA.RegionType.ANNPOLYGON:
                    case CARTA.RegionType.LINE:
                    case CARTA.RegionType.ANNLINE:
                    case CARTA.RegionType.POLYLINE:
                    case CARTA.RegionType.ANNPOLYLINE:
                    case CARTA.RegionType.ANNPOINT:
                    case CARTA.RegionType.ANNVECTOR:
                    case CARTA.RegionType.ANNRULER:
                        switch (region.regionType) {
                            case CARTA.RegionType.ANNPOINT:
                                annotationStyles = (region as PointAnnotationStore).getAnnotationStyles();
                                break;
                            case CARTA.RegionType.ANNVECTOR:
                                annotationStyles = (region as VectorAnnotationStore).getAnnotationStyles();
                                break;
                            case CARTA.RegionType.ANNRULER:
                                annotationStyles = (region as RulerAnnotationStore).getAnnotationStyles();
                                break;
                        }

                        for (const point of region.controlPoints) {
                            const pointNewFrame = transformPoint(spatialTransformAST, point, isForward);
                            if (!isAstBadPoint(pointNewFrame)) {
                                newControlPoints.push(pointNewFrame);
                            }
                        }
                        break;
                    default:
                        break;
                }

                if (newControlPoints.length) {
                    let newRegion: RegionStore;
                    if (region.regionType === CARTA.RegionType.POINT) {
                        newRegion = this.addRegion(newControlPoints, 0, CARTA.RegionType.POINT);
                        newRegion.setName(region.name);
                        newRegion.setColor(region.color);
                    } else if (region.regionType === CARTA.RegionType.ANNPOINT) {
                        newRegion = this.addRegion(newControlPoints, 0, CARTA.RegionType.ANNPOINT);
                        newRegion.setName(region.name);
                        newRegion.setColor(region.color);
                        (newRegion as PointAnnotationStore).initializeStyles(annotationStyles);
                    } else {
                        newRegion = this.addExistingRegion(newControlPoints, rotation, region.regionType, newId, region.name, region.color, region.lineWidth, region.dashLength ? [region.dashLength] : [], true, annotationStyles);
                        newRegion.endCreating();
                    }
                    newRegion.setLocked(region.isLocked);
                    newRegion.setOpacity(region.opacity);
                    // Link the two regions together
                    newRegion.modifiedTimestamp = region.modifiedTimestamp;
                    newId--;
                }
            }
        }
    };

    @action setLocked(shouldLock?: boolean) {
        this.isLocked = shouldLock === undefined ? !this.isLocked : shouldLock;
    }
}
