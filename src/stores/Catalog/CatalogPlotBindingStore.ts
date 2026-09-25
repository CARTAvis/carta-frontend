import {action, makeObservable, observable} from "mobx";

import {CatalogOverlay, WorkspaceItemKind} from "enums";
import {describeCatalogSource, type WorkspaceCatalog, type WorkspaceIssue} from "models";
import type {CatalogStore} from "stores/Catalog/CatalogStore";
import type {CatalogPlotWidgetConfig} from "stores/Widgets/CatalogWidget/CatalogPlotWidgetStore";
import type {WidgetsStore} from "stores/Widgets/WidgetsStore";
import {WorkspaceIdRegistry} from "stores/Workspace/WorkspaceIdRegistry";
import {isCatalogNumericDataType} from "utilities";

/** A plot tab's current catalog and the plot it keeps for each catalog it has shown. */
class CatalogPlotState {
    @observable activeCatalogFileId: number;
    readonly plotWidgetIds = observable.map<number, string>();

    constructor(catalogFileId: number) {
        this.activeCatalogFileId = catalogFileId;
        makeObservable(this);
    }

    @action setActiveCatalogFileId = (catalogFileId: number | undefined) => {
        this.activeCatalogFileId = catalogFileId ?? 0;
    };
}

/**
 * Owns the binding between catalog plot tabs, their per-catalog plot settings, and the catalogs a
 * Workspace knows them by. Plot settings remain in CatalogPlotWidgetStore; callers do not need to
 * coordinate its lifetime or translate between session and Workspace IDs themselves.
 */
export class CatalogPlotBindingStore {
    private readonly plots = observable.map<string, CatalogPlotState>();
    /** Retained when a catalog-specific plot closes, because its Layout tab still has this ID. */
    private readonly retainedComponents = observable.map<string, string>();
    /** A missing catalog's Workspace ID remains held through an automatic fallback. */
    private readonly workspaceCatalogIds = observable.map<string, number>();

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

    public isWidgetIdReserved(widgetId: string): boolean {
        return this.retainedComponents.has(widgetId);
    }

    public displayedForComponent(componentId: string): {catalogFileId: number; widgetId: string | undefined} | undefined {
        const state = this.plots.get(componentId);
        if (!state) {
            return undefined;
        }
        return {catalogFileId: state.activeCatalogFileId, widgetId: state.plotWidgetIds.get(state.activeCatalogFileId)};
    }

    /** Resolve even a tab whose original catalog and plot settings have since closed. */
    public displayedForWidget(widgetId: string): {componentId: string | undefined; catalogFileId: number | undefined; widgetId: string} {
        const association = this.associationForWidget(widgetId);
        const state = association.componentId === undefined ? undefined : this.plots.get(association.componentId);
        const catalogFileId = state?.activeCatalogFileId ?? association.catalogFileId;
        const shownWidgetId = catalogFileId === undefined ? undefined : state?.plotWidgetIds.get(catalogFileId);
        return {
            componentId: association.componentId,
            catalogFileId,
            widgetId: shownWidgetId ?? widgetId
        };
    }

    /** Register a restored Layout tab while its saved catalog is being resolved. */
    public registerRestored(componentId: string, widgetId: string): void {
        const activeCatalogFileIds = this.catalogs.activeCatalogFiles;
        const savedCatalogFileId = WorkspaceIdRegistry.Instance.sessionIdOf(WorkspaceItemKind.Catalog, this.workspaceCatalogIds.get(widgetId));
        const catalogFileId = (savedCatalogFileId !== undefined && activeCatalogFileIds.includes(savedCatalogFileId) ? savedCatalogFileId : activeCatalogFileIds[0]) ?? 1;
        this.register(componentId, catalogFileId, widgetId);
    }

    /** Register the plot kept for one catalog; keep its tab association after that catalog closes. */
    @action register = (componentId: string, catalogFileId: number, widgetId: string): void => {
        let state = this.plots.get(componentId);
        if (!state) {
            state = new CatalogPlotState(catalogFileId);
            this.plots.set(componentId, state);
        }
        state.plotWidgetIds.set(catalogFileId, widgetId);
        this.retainedComponents.set(widgetId, componentId);
        if (catalogFileId !== 0) {
            this.validateColumns(catalogFileId);
        }
    };

    /** An explicit choice replaces a saved binding, including one whose catalog was unavailable. */
    @action selectCatalog = (componentId: string, catalogFileId: number): string | undefined => {
        const state = this.plots.get(componentId);
        state?.setActiveCatalogFileId(catalogFileId);
        if (!this.catalogs.catalogProfileStores.has(catalogFileId)) {
            return state?.plotWidgetIds.get(catalogFileId);
        }
        const widgetId = state?.plotWidgetIds.get(catalogFileId);
        const workspaceCatalogId = WorkspaceIdRegistry.Instance.workspaceIdOf(WorkspaceItemKind.Catalog, catalogFileId);
        if (widgetId && workspaceCatalogId !== undefined) {
            this.setWorkspaceCatalogId(widgetId, workspaceCatalogId);
        }
        return widgetId;
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

    @action resetSelections = (activeCatalogFileIds: number[]): void => {
        if (!activeCatalogFileIds.length) {
            return;
        }
        const active = new Set(activeCatalogFileIds);
        this.plots.forEach(state => {
            if (!active.has(state.activeCatalogFileId)) {
                state.setActiveCatalogFileId(activeCatalogFileIds[0]);
            }
        });
    };

    /** A closed catalog drops its own plot, then leaves each tab on an available catalog. */
    @action closeCatalog = (catalogFileId: number): void => {
        const imageFileId = this.catalogs.getImageIdByCatalog(catalogFileId);
        const available = (imageFileId === undefined ? [] : (this.catalogs.imageAssociatedCatalogId.get(imageFileId) ?? [])).filter(fileId => fileId !== catalogFileId && this.catalogs.catalogProfileStores.has(fileId));
        this.plots.forEach(state => {
            const widgetId = state.plotWidgetIds.get(catalogFileId);
            if (widgetId) {
                this.deletePlot(widgetId);
            }
            state.plotWidgetIds.delete(catalogFileId);
            if (state.activeCatalogFileId === catalogFileId) {
                const remaining = available.find(fileId => state.plotWidgetIds.has(fileId)) ?? available[0] ?? state.plotWidgetIds.keys().next().value;
                state.setActiveCatalogFileId(remaining);
            }
        });
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

    /** Apply plot settings and its Workspace Catalog binding together. */
    @action restoreConfig = (widgetId: string, config: Partial<CatalogPlotWidgetConfig>): void => {
        this.widgets().catalogPlotWidgets.get(widgetId)?.applyConfig(config);
        if (typeof config.catalogId === "number" && Number.isInteger(config.catalogId)) {
            this.setWorkspaceCatalogId(widgetId, config.catalogId);
        }
    };

    /** Drop plot settings and the Catalog ID they held, including an unmounted plot. */
    @action deletePlot = (widgetId: string): void => {
        this.releaseWorkspaceCatalogId(widgetId);
        this.widgets().catalogPlotWidgets.delete(widgetId);
    };

    @action private setWorkspaceCatalogId = (widgetId: string, workspaceCatalogId: number): void => {
        if (this.workspaceCatalogIds.get(widgetId) === workspaceCatalogId) {
            return;
        }
        this.releaseWorkspaceCatalogId(widgetId);
        this.workspaceCatalogIds.set(widgetId, workspaceCatalogId);
        WorkspaceIdRegistry.Instance.reserve(WorkspaceItemKind.Catalog, workspaceCatalogId);
    };

    @action private releaseWorkspaceCatalogId = (widgetId: string): void => {
        const workspaceCatalogId = this.workspaceCatalogIds.get(widgetId);
        if (workspaceCatalogId === undefined) {
            return;
        }
        WorkspaceIdRegistry.Instance.releaseReservation(WorkspaceItemKind.Catalog, workspaceCatalogId);
        this.workspaceCatalogIds.delete(widgetId);
    };

    /** Saved Layouts omit catalog binding; the Layout carried by a Workspace keeps it. */
    public configForLayout(widgetId: string, shouldIncludeWorkspaceBindings: boolean): CatalogPlotWidgetConfig | undefined {
        const association = this.associationForWidget(widgetId);
        const state = association.componentId === undefined ? undefined : this.plots.get(association.componentId);
        const shownFileId = state?.activeCatalogFileId ?? association.catalogFileId;
        const shownWidgetId = shownFileId === undefined ? undefined : state?.plotWidgetIds.get(shownFileId);
        const shownStore = shownWidgetId === undefined ? undefined : this.widgets().catalogPlotWidgets.get(shownWidgetId);
        const plotStore = shownStore ?? this.widgets().catalogPlotWidgets.get(widgetId);
        if (!plotStore) {
            return undefined;
        }
        const config = plotStore.toConfig();
        if (shouldIncludeWorkspaceBindings) {
            const activeWidgetId = shownStore && shownWidgetId ? shownWidgetId : widgetId;
            const activeFileId = shownStore ? shownFileId : association.catalogFileId;
            const savedId = this.workspaceCatalogIds.get(activeWidgetId);
            config.catalogId = savedId ?? (activeFileId !== undefined && this.catalogs.catalogProfileStores.has(activeFileId) ? WorkspaceIdRegistry.Instance.workspaceIdOf(WorkspaceItemKind.Catalog, activeFileId) : undefined);
        }
        return config;
    }

    /** Apply the plot bindings after the Workspace's catalogs and Layout have been restored. */
    @action restoreWorkspacePlots = (catalogs: WorkspaceCatalog[] | undefined, catalogIds: Map<number, number>): WorkspaceIssue[] => {
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
        for (const [widgetId, plotStore] of this.widgets().catalogPlotWidgets) {
            const workspaceCatalogId = this.workspaceCatalogIds.get(widgetId);
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
                    return {componentId, catalogFileId: fileId};
                }
            }
        }
        const componentId = this.retainedComponents.get(widgetId);
        return {componentId, catalogFileId: componentId === undefined ? undefined : this.plots.get(componentId)?.activeCatalogFileId};
    }
}
