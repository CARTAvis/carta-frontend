import {action, makeObservable, observable} from "mobx";

import {CatalogOverlay, WorkspaceItemKind} from "enums";
import {describeCatalogSource, type WorkspaceCatalog, type WorkspaceIssue} from "models";
import type {CatalogStore} from "stores/Catalog/CatalogStore";
import type {CatalogPlotWidgetConfig} from "stores/Widgets/CatalogWidget/CatalogPlotWidgetStore";
import type {WidgetsStore} from "stores/Widgets/WidgetsStore";
import {WorkspaceIdRegistry} from "stores/Workspace/WorkspaceIdRegistry";
import {isCatalogNumericDataType} from "utilities";

/** Where a plot made before its tab had a catalog is kept, until Restore or a choice gives it one. */
const UNBOUND_PLOT_KEY = 0;

/** A plot tab's current catalog and the plot it keeps for each catalog it has shown. */
class CatalogPlotState {
    /** The catalog the tab shows, or undefined when it has none. */
    @observable activeCatalogFileId: number | undefined;
    readonly plotWidgetIds = observable.map<number, string>();

    constructor(catalogFileId: number | undefined) {
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
    /** The Workspace catalog each restored plot was saved against, held only until Restore binds it. */
    private readonly restoredCatalogIds = observable.map<string, number>();

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

    /** The Workspace catalog each table widget shows, keyed by the widget's own stable ID. */
    public savedTableCatalogIds(): Record<string, number> {
        const saved: Record<string, number> = {};
        this.widgets().catalogWidgets.forEach((widgetStore, componentId) => {
            const catalogFileId = this.tableCatalogs.get(componentId);
            // A widget showing no loaded catalog names none: a Workspace describes only what was loaded.
            if (catalogFileId === undefined || !this.catalogs.catalogProfileStores.has(catalogFileId)) {
                return;
            }
            const workspaceCatalogId = WorkspaceIdRegistry.Instance.workspaceIdOf(WorkspaceItemKind.Catalog, catalogFileId);
            if (workspaceCatalogId !== undefined) {
                saved[widgetStore.widgetId || componentId] = workspaceCatalogId;
            }
        });
        return saved;
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

    /** Register a restored Layout tab while its saved catalog is being resolved. */
    public registerRestored(componentId: string, widgetId: string): void {
        const activeCatalogFileIds = this.catalogs.activeCatalogFiles;
        const savedCatalogFileId = WorkspaceIdRegistry.Instance.sessionIdOf(WorkspaceItemKind.Catalog, this.restoredCatalogIds.get(widgetId));
        const catalogFileId = savedCatalogFileId !== undefined && activeCatalogFileIds.includes(savedCatalogFileId) ? savedCatalogFileId : activeCatalogFileIds[0];
        this.register(componentId, catalogFileId, widgetId);
    }

    /** Register the plot kept for one catalog; keep its tab association after that catalog closes. */
    @action register = (componentId: string, catalogFileId: number | undefined, widgetId: string): void => {
        let state = this.plots.get(componentId);
        if (!state) {
            state = new CatalogPlotState(catalogFileId);
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

    /** Apply plot settings, holding the Workspace catalog they name until Restore binds it. */
    @action restoreConfig = (widgetId: string, config: Partial<CatalogPlotWidgetConfig>): void => {
        this.widgets().catalogPlotWidgets.get(widgetId)?.applyConfig(config);
        if (typeof config.catalogId === "number" && Number.isInteger(config.catalogId)) {
            this.restoredCatalogIds.set(widgetId, config.catalogId);
        } else {
            this.restoredCatalogIds.delete(widgetId);
        }
    };

    /** Drop plot settings, including an unmounted plot. */
    @action deletePlot = (widgetId: string): void => {
        this.restoredCatalogIds.delete(widgetId);
        this.widgets().catalogPlotWidgets.delete(widgetId);
    };

    /** Saved Layouts omit catalog binding; the Layout carried by a Workspace keeps it. */
    public configForLayout(widgetId: string, shouldIncludeWorkspaceBindings: boolean): CatalogPlotWidgetConfig | undefined {
        const association = this.associationForWidget(widgetId);
        const state = association.componentId === undefined ? undefined : this.plots.get(association.componentId);
        const shownFileId = state ? state.activeCatalogFileId : association.catalogFileId;
        const shownWidgetId = state?.plotFor(shownFileId);
        const shownStore = shownWidgetId === undefined ? undefined : this.widgets().catalogPlotWidgets.get(shownWidgetId);
        const plotStore = shownStore ?? this.widgets().catalogPlotWidgets.get(widgetId);
        if (!plotStore) {
            return undefined;
        }
        const config = plotStore.toConfig();
        if (shouldIncludeWorkspaceBindings) {
            // A plot showing no loaded catalog names none: a Workspace describes only what was loaded.
            const activeFileId = shownStore ? shownFileId : association.catalogFileId;
            config.catalogId = activeFileId !== undefined && this.catalogs.catalogProfileStores.has(activeFileId) ? WorkspaceIdRegistry.Instance.workspaceIdOf(WorkspaceItemKind.Catalog, activeFileId) : undefined;
        }
        return config;
    }

    /**
     * Point the table and plot widgets at the catalogs they were saved against, once the Workspace's
     * catalogs and Layout have been restored. A widget whose catalog is unavailable takes the catalog
     * it falls back to as its own.
     *
     * @param selectedCatalogIds - the Workspace catalog each table widget showed, by stable widget ID.
     * @param catalogIds - Workspace catalog ID : the file ID it was restored as.
     */
    @action restore = (selectedCatalogIds: Record<string, number> | undefined, catalogs: WorkspaceCatalog[] | undefined, catalogIds: Map<number, number>): WorkspaceIssue[] => {
        const issues: WorkspaceIssue[] = [];
        const describe = (id: number) => {
            const catalog = catalogs?.find(candidate => candidate.id === id);
            return catalog ? `the catalog ${describeCatalogSource(catalog.source)}` : `workspace catalog ${id}`;
        };
        const describeFile = (fileId: number) => {
            for (const [workspaceId, restoredFileId] of catalogIds) {
                if (restoredFileId === fileId) {
                    return describe(workspaceId);
                }
            }
            return `catalog file ${fileId}`;
        };

        if (selectedCatalogIds) {
            this.widgets().restoreCatalogWidgets(Object.keys(selectedCatalogIds));
            for (const [widgetId, workspaceCatalogId] of Object.entries(selectedCatalogIds)) {
                const componentIds = Array.from(this.widgets().catalogWidgets.entries())
                    .filter(([, widgetStore]) => widgetStore.widgetId === widgetId)
                    .map(([componentId]) => componentId);
                const catalogFileId = catalogIds.get(workspaceCatalogId);
                if (catalogFileId === undefined) {
                    const componentId = componentIds[0];
                    const shown = componentId === undefined ? undefined : this.tableCatalogs.get(componentId);
                    if (componentId !== undefined && (shown === undefined || !this.catalogs.catalogProfileStores.has(shown))) {
                        this.initTable(componentId, this.fallbackCatalog(undefined, undefined));
                    }
                    const fallbackFileId = componentId === undefined ? undefined : this.tableCatalogs.get(componentId);
                    const fallback = fallbackFileId !== undefined && this.catalogs.catalogProfileStores.has(fallbackFileId) ? `; it is showing ${describeFile(fallbackFileId)} instead` : "";
                    issues.push({kind: WorkspaceItemKind.CatalogWidget, subject: widgetId, message: `Could not restore catalog widget ${widgetId}: ${describe(workspaceCatalogId)} is unavailable${fallback}`});
                } else if (componentIds.length !== 1 || !this.show(componentIds[0], catalogFileId)) {
                    issues.push({kind: WorkspaceItemKind.CatalogWidget, subject: widgetId, message: `Could not restore catalog widget ${widgetId} to ${describe(workspaceCatalogId)}: the widget selection could not be applied`});
                }
            }
        }

        for (const [widgetId, plotStore] of this.widgets().catalogPlotWidgets) {
            const workspaceCatalogId = this.restoredCatalogIds.get(widgetId);
            if (workspaceCatalogId === undefined) {
                continue;
            }
            const catalogFileId = catalogIds.get(workspaceCatalogId);
            const association = this.associationForWidget(widgetId);
            if (catalogFileId === undefined) {
                const shownFileId = association.catalogFileId;
                const fallback = shownFileId !== undefined && this.catalogs.catalogProfileStores.has(shownFileId) ? `; it is showing ${describeFile(shownFileId)} instead` : "";
                issues.push({kind: WorkspaceItemKind.CatalogPlot, subject: widgetId, message: `Could not restore catalog plot ${widgetId}: ${describe(workspaceCatalogId)} is unavailable${fallback}`});
                continue;
            }
            if (association.catalogFileId !== catalogFileId && !this.rebind(widgetId, catalogFileId)) {
                issues.push({kind: WorkspaceItemKind.CatalogPlot, subject: widgetId, message: `Could not restore catalog plot ${widgetId} to ${describe(workspaceCatalogId)}: the plot association could not be applied`});
                continue;
            }
            const profileStore = this.catalogs.catalogProfileStores.get(catalogFileId);
            const availableColumns = new Set(profileStore?.catalogHeader.map(header => header.name));
            const columns = [plotStore.xColumnName, plotStore.yColumnName, plotStore.statisticColumnName].filter((column): column is string => typeof column === "string" && column !== CatalogOverlay.NONE);
            const missing = columns.filter(column => !availableColumns.has(column));
            if (missing.length) {
                issues.push({
                    kind: WorkspaceItemKind.CatalogPlot,
                    subject: widgetId,
                    message: `Could not fully restore catalog plot ${widgetId} for ${describe(workspaceCatalogId)}: ${missing.map(column => `column ${column}`).join(", ")} is unavailable`
                });
            }
        }
        this.restoredCatalogIds.clear();
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
