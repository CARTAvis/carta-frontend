import {action, makeObservable, observable} from "mobx";

import {WorkspaceItemKind} from "enums";
import {describeCatalogSource, type WorkspaceCatalog, type WorkspaceCatalogWidgetConfig, type WorkspaceIssue} from "models";
import type {CatalogStore} from "stores/Catalog/CatalogStore";
import type {CatalogPlotLayoutSettings} from "stores/Widgets/CatalogWidget/CatalogPlotWidgetStore";
import type {WidgetsStore} from "stores/Widgets/WidgetsStore";
import {WorkspaceIdRegistry} from "stores/Workspace/WorkspaceIdRegistry";
import {isCatalogNumericDataType} from "utilities";

/** Where a plot made before its tab had a catalog is kept, until Restore or a choice gives it one. */
const UNBOUND_PLOT_KEY = 0;

/** A plot tab's current catalog and the plot it keeps for each catalog it has shown. */
class CatalogPlotState {
    /** The tab's own identity, stable across the sessions a workspace spans, unlike its component ID. */
    readonly widgetId: string;
    /** The catalog the tab shows, or undefined when it has none. */
    @observable activeCatalogFileId: number | undefined;
    readonly plotWidgetIds = observable.map<number, string>();

    constructor(widgetId: string, catalogFileId: number | undefined) {
        this.widgetId = widgetId;
        this.activeCatalogFileId = catalogFileId;
        makeObservable(this);
    }

    @action setActiveCatalogFileId = (catalogFileId: number | undefined) => {
        this.activeCatalogFileId = catalogFileId;
    };

    plotFor(catalogFileId: number | undefined): string | undefined {
        return this.plotWidgetIds.get(catalogFileId ?? UNBOUND_PLOT_KEY);
    }
}

/**
 * Which catalog each catalog table and plot widget shows, and what happens to that when catalogs
 * open and close, the active image changes, or a Workspace is saved and restored.
 *
 * Table widgets themselves belong to WidgetsStore, and plot settings to CatalogPlotWidgetStore; this
 * owns only the binding, so that every rule about it is written once for both kinds of widget.
 */
export class CatalogWidgetBindingStore {
    /** Catalog table widget component ID : the catalog it shows. */
    private readonly tableCatalogs = observable.map<string, number>();
    private readonly plots = observable.map<string, CatalogPlotState>();
    /** Retained when a catalog-specific plot closes, because its Layout tab still has this ID. */
    private readonly retainedComponents = observable.map<string, string>();

    constructor(
        private readonly catalogs: CatalogStore,
        private readonly widgets: () => WidgetsStore,
        private readonly warn: (message: string) => void
    ) {
        makeObservable(this);
    }

    public componentIds(): string[] {
        return Array.from(this.plots.keys());
    }

    /** The catalog a table or plot widget shows, or undefined when it shows none. */
    public catalogOf(componentId: string): number | undefined {
        const state = this.plots.get(componentId);
        return state ? state.activeCatalogFileId : this.tableCatalogs.get(componentId);
    }

    /** Show a loaded catalog in a table or plot widget. */
    @action show = (componentId: string, catalogFileId: number): boolean => {
        if (!this.catalogs.catalogProfileStores.has(catalogFileId)) {
            return false;
        }
        const state = this.plots.get(componentId);
        if (state) {
            state.setActiveCatalogFileId(catalogFileId);
            return true;
        }
        if (!this.widgets().catalogWidgets.has(componentId)) {
            return false;
        }
        this.tableCatalogs.set(componentId, catalogFileId);
        return true;
    };

    /** Give a new table widget the catalog it starts on, if any. */
    @action initTable = (componentId: string, catalogFileId: number | undefined): void => {
        if (catalogFileId === undefined) {
            this.tableCatalogs.delete(componentId);
        } else {
            this.tableCatalogs.set(componentId, catalogFileId);
        }
    };

    @action removeTable = (componentId: string): void => {
        this.tableCatalogs.delete(componentId);
    };

    /**
     * Show a catalog in the table widget already showing it, or else the first one.
     *
     * @returns that widget's component ID, or undefined when there is no table widget.
     */
    @action showInTable = (catalogFileId: number): string | undefined => {
        const tableIds = this.tableIds();
        const componentId = tableIds.find(id => this.tableCatalogs.get(id) === catalogFileId) ?? tableIds[0];
        if (componentId !== undefined) {
            this.tableCatalogs.set(componentId, catalogFileId);
        }
        return componentId;
    };

    /** A newly opened catalog is shown in a table widget, giving it one of its own if none exists. */
    @action catalogOpened = (catalogFileId: number, isFirstOnImage: boolean): void => {
        if (isFirstOnImage) {
            // Every table moves to a new image's first catalog.
            this.tableIds().forEach(id => this.tableCatalogs.set(id, catalogFileId));
        }
        if (this.showInTable(catalogFileId) === undefined) {
            this.widgets().createFloatingCatalogWidget(catalogFileId);
        }
    };

    /** Keep every widget on a catalog of the image now in front; one with none left keeps its own. */
    @action activeImageChanged = (imageFileId: number): void => {
        const catalogFileIds = this.catalogs.catalogsOn(imageFileId);
        if (!catalogFileIds.length) {
            return;
        }
        const onImage = new Set(catalogFileIds);
        this.tableIds().forEach(id => {
            const shown = this.tableCatalogs.get(id);
            if (shown === undefined || !onImage.has(shown)) {
                this.tableCatalogs.set(id, catalogFileIds[0]);
            }
        });
        this.plots.forEach(state => {
            if (state.activeCatalogFileId === undefined || !onImage.has(state.activeCatalogFileId)) {
                state.setActiveCatalogFileId(catalogFileIds[0]);
            }
        });
    };

    /**
     * Move every widget showing a catalog that is closing onto the catalog it falls back to, and drop
     * the plots kept for it. Called while the catalog still names its image.
     */
    @action catalogClosed = (catalogFileId: number): void => {
        const imageFileId = this.catalogs.imageIdOf(catalogFileId);
        this.tableIds().forEach(id => {
            if (this.tableCatalogs.get(id) === catalogFileId) {
                this.initTable(id, this.fallbackCatalog(imageFileId, catalogFileId));
            }
        });
        this.plots.forEach(state => {
            const widgetId = state.plotWidgetIds.get(catalogFileId);
            if (widgetId) {
                this.deletePlot(widgetId);
            }
            state.plotWidgetIds.delete(catalogFileId);
            if (state.activeCatalogFileId === catalogFileId) {
                state.setActiveCatalogFileId(this.fallbackCatalog(imageFileId, catalogFileId, state));
            }
        });
    };

    /**
     * The catalog a widget falls back to when the one it showed is gone: one on the same image the
     * widget already has plot settings for, the first on that image, the first on the active image,
     * and otherwise none. A catalog on any other image would not be shown.
     */
    private fallbackCatalog(imageFileId: number | undefined, excludedFileId: number | undefined, plot?: CatalogPlotState): number | undefined {
        const isAvailable = (fileId: number) => fileId !== excludedFileId && this.catalogs.catalogProfileStores.has(fileId);
        const onImage = imageFileId === undefined ? [] : this.catalogs.catalogsOn(imageFileId).filter(isAvailable);
        return onImage.find(fileId => plot?.plotWidgetIds.has(fileId)) ?? onImage[0] ?? this.catalogs.activeCatalogFiles.find(isAvailable);
    }

    private tableIds(): string[] {
        return Array.from(this.widgets().catalogWidgets.keys());
    }

    /**
     * What each table and plot widget shows, keyed by the widget's own stable ID. A widget showing no
     * loaded catalog names none: a Workspace describes only what was loaded (ADR-0006).
     */
    public savedCatalogWidgets(): Record<string, WorkspaceCatalogWidgetConfig> {
        const saved: Record<string, WorkspaceCatalogWidgetConfig> = {};
        this.widgets().catalogWidgets.forEach((widgetStore, componentId) => {
            const catalogId = this.workspaceIdOfLoaded(this.tableCatalogs.get(componentId));
            const settingsTabs = widgetStore.workspaceSettingsTabs();
            const hasSettingsTabs = Object.keys(settingsTabs).length > 0;
            if (catalogId !== undefined || hasSettingsTabs) {
                saved[widgetStore.widgetId || componentId] = {type: "catalog-overlay", ...(catalogId !== undefined ? {catalogId} : {}), ...(hasSettingsTabs ? {settingsTabs} : {})};
            }
        });
        this.plots.forEach(state => {
            const catalogId = this.workspaceIdOfLoaded(state.activeCatalogFileId);
            const plotWidgetId = state.plotFor(state.activeCatalogFileId);
            const plotStore = plotWidgetId === undefined ? undefined : this.widgets().catalogPlotWidgets.get(plotWidgetId);
            // What a plot is drawn from means nothing without the catalog it is drawn from.
            if (catalogId !== undefined && plotStore) {
                saved[state.widgetId] = {type: "catalog-plot", catalogId, ...plotStore.toConfig()};
            }
        });
        return saved;
    }

    private workspaceIdOfLoaded(catalogFileId: number | undefined): number | undefined {
        return catalogFileId !== undefined && this.catalogs.catalogProfileStores.has(catalogFileId) ? WorkspaceIdRegistry.Instance.workspaceIdOf(WorkspaceItemKind.Catalog, catalogFileId) : undefined;
    }

    /** A stable ID no other table or plot widget has, starting from the one preferred. */
    private uniqueWidgetId(preferredId: string): string {
        const taken = new Set<string>([...Array.from(this.plots.values(), state => state.widgetId), ...Array.from(this.widgets().catalogWidgets.values(), widgetStore => widgetStore.widgetId)]);
        let widgetId = preferredId;
        for (let index = 1; taken.has(widgetId); index++) {
            widgetId = `${preferredId}-${index}`;
        }
        return widgetId;
    }

    public isWidgetIdReserved(widgetId: string): boolean {
        return this.retainedComponents.has(widgetId);
    }

    public displayedForComponent(componentId: string): {catalogFileId: number | undefined; widgetId: string | undefined} | undefined {
        const state = this.plots.get(componentId);
        if (!state) {
            return undefined;
        }
        return {catalogFileId: state.activeCatalogFileId, widgetId: state.plotFor(state.activeCatalogFileId)};
    }

    /** Resolve even a tab whose original catalog and plot settings have since closed. */
    public displayedForWidget(widgetId: string): {componentId: string | undefined; catalogFileId: number | undefined; widgetId: string} {
        const association = this.associationForWidget(widgetId);
        const state = association.componentId === undefined ? undefined : this.plots.get(association.componentId);
        const catalogFileId = state ? state.activeCatalogFileId : association.catalogFileId;
        const shownWidgetId = state?.plotFor(catalogFileId);
        return {
            componentId: association.componentId,
            catalogFileId,
            widgetId: shownWidgetId ?? widgetId
        };
    }

    /**
     * Register a tab a Layout brought back, on the active image's first catalog until a Workspace
     * restore points it at the catalog it was saved against.
     *
     * @param stableWidgetId - the tab's own ID, as the Layout kept it.
     */
    public registerRestored(componentId: string, widgetId: string, stableWidgetId?: string): void {
        this.register(componentId, this.catalogs.activeCatalogFiles[0], widgetId, stableWidgetId);
    }

    /**
     * Register the plot kept for one catalog; keep its tab association after that catalog closes.
     *
     * @param stableWidgetId - for a new tab, the ID it is known by across sessions; by default the
     *     ID of its first plot.
     */
    @action register = (componentId: string, catalogFileId: number | undefined, widgetId: string, stableWidgetId?: string): void => {
        let state = this.plots.get(componentId);
        if (!state) {
            state = new CatalogPlotState(this.uniqueWidgetId(stableWidgetId || widgetId), catalogFileId);
            this.plots.set(componentId, state);
        }
        state.plotWidgetIds.set(catalogFileId ?? UNBOUND_PLOT_KEY, widgetId);
        this.retainedComponents.set(widgetId, componentId);
        if (catalogFileId !== undefined) {
            this.validateColumns(catalogFileId);
        }
    };

    /** Rebind a saved plot after its catalog has acquired a new session file ID. */
    @action private rebind = (widgetId: string, catalogFileId: number): boolean => {
        for (const state of this.plots.values()) {
            for (const [currentFileId, candidateId] of state.plotWidgetIds) {
                if (candidateId !== widgetId) {
                    continue;
                }
                if (currentFileId === catalogFileId) {
                    return false;
                }
                const replacedWidgetId = state.plotWidgetIds.get(catalogFileId);
                if (replacedWidgetId && replacedWidgetId !== widgetId) {
                    this.deletePlot(replacedWidgetId);
                }
                state.plotWidgetIds.delete(currentFileId);
                state.plotWidgetIds.set(catalogFileId, widgetId);
                state.setActiveCatalogFileId(catalogFileId);
                return true;
            }
        }
        return false;
    };

    @action closeComponent = (componentId: string): void => {
        const state = this.plots.get(componentId);
        if (state) {
            state.plotWidgetIds.forEach(widgetId => this.deletePlot(widgetId));
            this.plots.delete(componentId);
        }
        this.retainedComponents.forEach((retainedComponentId, widgetId) => {
            if (retainedComponentId === componentId) {
                this.retainedComponents.delete(widgetId);
            }
        });
    };

    @action closeWidget = (widgetId: string): void => {
        const componentId = this.associationForWidget(widgetId).componentId;
        if (componentId) {
            this.closeComponent(componentId);
        }
    };

    /** Drop plot settings, including an unmounted plot. */
    @action deletePlot = (widgetId: string): void => {
        this.widgets().catalogPlotWidgets.delete(widgetId);
    };

    /** What a Layout keeps for a plot tab: its identity and what survives any catalog, naming none. */
    public layoutSettingsFor(widgetId: string): CatalogPlotLayoutSettings | undefined {
        const association = this.associationForWidget(widgetId);
        const state = association.componentId === undefined ? undefined : this.plots.get(association.componentId);
        const shownWidgetId = state?.plotFor(state.activeCatalogFileId);
        const shownStore = shownWidgetId === undefined ? undefined : this.widgets().catalogPlotWidgets.get(shownWidgetId);
        const plotStore = shownStore ?? this.widgets().catalogPlotWidgets.get(widgetId);
        if (!plotStore) {
            return undefined;
        }
        return {...(state ? {widgetId: state.widgetId} : {}), ...plotStore.toLayoutSettings()};
    }

    /**
     * Point the table and plot widgets at the catalogs they were saved against, once the Workspace's
     * catalogs and Layout have been restored, and put back what each of them showed. A widget whose
     * catalog is unavailable takes the catalog it falls back to as its own, with nothing it was
     * drawn from: that means nothing against another catalog.
     *
     * @param catalogWidgets - what each widget showed, by stable widget ID.
     * @param catalogIds - Workspace catalog ID : the file ID it was restored as.
     */
    @action restore = (catalogWidgets: Record<string, WorkspaceCatalogWidgetConfig> | undefined, catalogs: WorkspaceCatalog[] | undefined, catalogIds: Map<number, number>): WorkspaceIssue[] => {
        const issues: WorkspaceIssue[] = [];
        const describe = (id: number) => {
            const catalog = catalogs?.find(candidate => candidate.id === id);
            return catalog ? `the catalog ${describeCatalogSource(catalog.source)}` : `workspace catalog ${id}`;
        };
        const describeFallback = (fileId: number | undefined) => {
            if (fileId === undefined || !this.catalogs.catalogProfileStores.has(fileId)) {
                return "";
            }
            for (const [workspaceId, restoredFileId] of catalogIds) {
                if (restoredFileId === fileId) {
                    return `; it is showing ${describe(workspaceId)} instead`;
                }
            }
            return `; it is showing catalog file ${fileId} instead`;
        };
        const entries = Object.entries(catalogWidgets ?? {});

        const tables = entries.filter(([, config]) => config.type === "catalog-overlay");
        if (tables.length) {
            this.widgets().restoreCatalogWidgets(tables.map(([widgetId]) => widgetId));
        }
        for (const [widgetId, config] of tables) {
            const matching = Array.from(this.widgets().catalogWidgets.entries()).filter(([, widgetStore]) => widgetStore.widgetId === widgetId);
            matching.forEach(([, widgetStore]) => widgetStore.applyWorkspaceSettingsTabs(config.settingsTabs ?? {}));
            if (config.catalogId === undefined) {
                continue;
            }
            const catalogFileId = catalogIds.get(config.catalogId);
            if (catalogFileId === undefined) {
                const componentId = matching[0]?.[0];
                const shown = componentId === undefined ? undefined : this.tableCatalogs.get(componentId);
                if (componentId !== undefined && (shown === undefined || !this.catalogs.catalogProfileStores.has(shown))) {
                    this.initTable(componentId, this.fallbackCatalog(undefined, undefined));
                }
                const fallback = componentId === undefined ? "" : describeFallback(this.tableCatalogs.get(componentId));
                issues.push({kind: WorkspaceItemKind.CatalogWidget, subject: widgetId, message: `Could not restore catalog widget ${widgetId}: ${describe(config.catalogId)} is unavailable${fallback}`});
            } else if (matching.length !== 1 || !this.show(matching[0][0], catalogFileId)) {
                issues.push({kind: WorkspaceItemKind.CatalogWidget, subject: widgetId, message: `Could not restore catalog widget ${widgetId} to ${describe(config.catalogId)}: the widget selection could not be applied`});
            }
        }

        for (const [widgetId, config] of entries.filter(([, entry]) => entry.type === "catalog-plot")) {
            const state = Array.from(this.plots.values()).find(candidate => candidate.widgetId === widgetId);
            if (!state || config.catalogId === undefined) {
                continue;
            }
            const catalogFileId = catalogIds.get(config.catalogId);
            if (catalogFileId === undefined) {
                issues.push({kind: WorkspaceItemKind.CatalogPlot, subject: widgetId, message: `Could not restore catalog plot ${widgetId}: ${describe(config.catalogId)} is unavailable${describeFallback(state.activeCatalogFileId)}`});
                continue;
            }
            const plotWidgetId = state.plotFor(state.activeCatalogFileId);
            if (plotWidgetId === undefined || (state.activeCatalogFileId !== catalogFileId && !this.rebind(plotWidgetId, catalogFileId))) {
                issues.push({kind: WorkspaceItemKind.CatalogPlot, subject: widgetId, message: `Could not restore catalog plot ${widgetId} to ${describe(config.catalogId)}: the plot association could not be applied`});
                continue;
            }
            const plotStore = this.widgets().catalogPlotWidgets.get(plotWidgetId);
            const profileStore = this.catalogs.catalogProfileStores.get(catalogFileId);
            plotStore?.applyConfig(config);
            const unavailable =
                plotStore?.resetUnknownColumns(column => {
                    const header = profileStore?.getColumnHeader(column);
                    return header !== undefined && isCatalogNumericDataType(header.dataType);
                }) ?? [];
            if (unavailable.length) {
                issues.push({
                    kind: WorkspaceItemKind.CatalogPlot,
                    subject: widgetId,
                    message: `Could not fully restore catalog plot ${widgetId} for ${describe(config.catalogId)}: ${unavailable.map(column => `column ${column}`).join(", ")} is unavailable`
                });
            }
        }
        return issues;
    };

    /** Validate when catalog columns arrive, including a catalog loaded before Layout apply. */
    @action validateColumns = (catalogFileId: number): void => {
        const profileStore = this.catalogs.catalogProfileStores.get(catalogFileId);
        if (!profileStore) {
            return;
        }
        const dropped = new Set<string>();
        this.plots.forEach(state => {
            const widgetId = state.plotWidgetIds.get(catalogFileId);
            const plotStore = widgetId ? this.widgets().catalogPlotWidgets.get(widgetId) : undefined;
            plotStore
                ?.resetUnknownColumns(column => {
                    const header = profileStore.getColumnHeader(column);
                    return header !== undefined && isCatalogNumericDataType(header.dataType);
                })
                .forEach(column => dropped.add(column));
        });
        if (dropped.size) {
            const catalogName = profileStore.catalogInfo.fileInfo.name ?? `catalog ${catalogFileId}`;
            const columns = Array.from(dropped)
                .map(column => `"${column}"`)
                .join(", ");
            this.warn(`Plot settings for ${catalogName} were not restored: ${columns} ${dropped.size > 1 ? "are not valid numeric columns" : "is not a valid numeric column"} in this catalog`);
        }
    };

    private associationForWidget(widgetId: string): {componentId: string | undefined; catalogFileId: number | undefined} {
        for (const [componentId, state] of this.plots) {
            for (const [fileId, candidateId] of state.plotWidgetIds) {
                if (candidateId === widgetId) {
                    return {componentId, catalogFileId: fileId === UNBOUND_PLOT_KEY ? undefined : fileId};
                }
            }
        }
        const componentId = this.retainedComponents.get(widgetId);
        return {componentId, catalogFileId: componentId === undefined ? undefined : this.plots.get(componentId)?.activeCatalogFileId};
    }
}
