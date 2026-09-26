import {action, makeObservable, observable} from "mobx";

import {CatalogSettingsTabs, WorkspaceItemKind} from "enums";
import {PreferenceStore} from "stores";
import {WorkspaceIdRegistry} from "stores/Workspace/WorkspaceIdRegistry";

/** State owned by one catalog widget rather than by the catalog it displays. */
export interface CatalogWidgetLayoutSettings {
    /** The widget's own identity, stable across the sessions a workspace spans. */
    widgetId?: string;
    /** Kept for layouts written while a widget named its catalog by the file ID of the session that saved it. */
    catalogFileId?: number;
    tableSeparatorPosition?: string;
    /** Widths of the header table's columns, as the user left them. */
    headerTableColumnWidths?: number[];
    /** The settings section this widget was left on, for whichever catalog it shows. A Workspace keeps
     * the section of each catalog itself, since a Layout names no catalog. */
    settingsTabId?: CatalogSettingsTabs;
}

export class CatalogWidgetStore {
    /** Columns of the header table: name, unit, type, display, description. */
    private static readonly HeaderTableColumnCount = 5;

    @observable widgetId: string;
    @observable tableSeparatorPosition: string = PreferenceStore.Instance.catalogTableSeparatorPosition;
    /**
     * Widths of the header table's columns. The table lists the catalog's columns but belongs to the
     * widget showing it, so two widgets on one catalog size their headers independently.
     */
    @observable headerTableColumnWidths: number[] = [150, 75, 65, 100, 230];
    /**
     * The settings section for each catalog this widget has shown. The section belongs to the widget,
     * so two widgets showing one catalog keep their own, but it is remembered per catalog so that a
     * widget returning to a catalog returns to the section that catalog was left on.
     */
    @observable private settingsTabIdByCatalog = new Map<number, CatalogSettingsTabs>();
    /** The section left on while the widget showed no catalog, for whichever catalog it shows next. */
    @observable private defaultSettingsTabId: CatalogSettingsTabs | undefined = undefined;

    constructor(widgetId: string = "") {
        this.widgetId = widgetId;
        makeObservable(this);
    }

    @action setWidgetId = (widgetId: string) => {
        this.widgetId = widgetId;
    };

    @action setTableSeparatorPosition = (position: string) => {
        this.tableSeparatorPosition = position;
    };

    /** Resize one header table column, growing the widths to cover every column if they do not yet. */
    @action setHeaderTableColumnWidth = (index: number, width: number) => {
        if (index < 0 || index >= CatalogWidgetStore.HeaderTableColumnCount) {
            return;
        }
        if (this.headerTableColumnWidths.length !== CatalogWidgetStore.HeaderTableColumnCount) {
            const resized = new Array(CatalogWidgetStore.HeaderTableColumnCount).fill(undefined);
            for (let i = 0; i < Math.min(this.headerTableColumnWidths.length, resized.length); i++) {
                resized[i] = this.headerTableColumnWidths[i];
            }
            this.headerTableColumnWidths = resized;
        }
        this.headerTableColumnWidths[index] = width;
    };

    /** The settings section this widget was left on for one catalog. */
    settingsTabFor(catalogFileId: number | undefined): CatalogSettingsTabs {
        return (catalogFileId === undefined ? undefined : this.settingsTabIdByCatalog.get(catalogFileId)) ?? this.defaultSettingsTabId ?? CatalogSettingsTabs.SIZE;
    }

    @action setSettingsTab = (catalogFileId: number | undefined, tabId: CatalogSettingsTabs) => {
        if (catalogFileId === undefined) {
            this.defaultSettingsTabId = tabId;
        } else {
            this.settingsTabIdByCatalog.set(catalogFileId, tabId);
        }
    };

    /** @param shownCatalogFileId - the catalog the widget shows, whose section the layout keeps. */
    public toLayoutSettings = (shownCatalogFileId?: number): CatalogWidgetLayoutSettings => ({
        ...(this.widgetId ? {widgetId: this.widgetId} : {}),
        tableSeparatorPosition: this.tableSeparatorPosition,
        ...(this.headerTableColumnWidths.every(width => Number.isFinite(width)) ? {headerTableColumnWidths: [...this.headerTableColumnWidths]} : {}),
        settingsTabId: this.settingsTabFor(shownCatalogFileId)
    });

    /**
     * The settings section of each catalog the widget has shown, by the Workspace's own ID for that
     * catalog: the file IDs of a session are handed out again to other catalogs when it is reopened.
     */
    public workspaceSettingsTabs = (): Record<string, CatalogSettingsTabs> => {
        const workspaceSettingsTabs: Record<string, CatalogSettingsTabs> = {};
        this.settingsTabIdByCatalog.forEach((tabId, catalogFileId) => {
            const workspaceCatalogId = WorkspaceIdRegistry.Instance.workspaceIdOf(WorkspaceItemKind.Catalog, catalogFileId);
            // A catalog this session no longer has is not one the workspace can name.
            if (workspaceCatalogId !== undefined) {
                workspaceSettingsTabs[String(workspaceCatalogId)] = tabId;
            }
        });
        return workspaceSettingsTabs;
    };

    /** Put back the section of each catalog a Workspace kept, for the catalogs it brought back. */
    @action applyWorkspaceSettingsTabs = (settingsTabs: Record<string, number>) => {
        for (const [workspaceCatalogId, tabId] of Object.entries(settingsTabs)) {
            const catalogFileId = Number.isFinite(Number(workspaceCatalogId)) ? WorkspaceIdRegistry.Instance.sessionIdOf(WorkspaceItemKind.Catalog, Number(workspaceCatalogId)) : undefined;
            if (catalogFileId !== undefined && typeof tabId === "number") {
                this.settingsTabIdByCatalog.set(catalogFileId, tabId);
            }
        }
    };

    /**
     * Put back what a layout held for this widget.
     *
     * Which catalog the widget is on is settled before this is called, and is not read out of the
     * settings here: a section the widget was left on is kept per catalog, and filing it under an
     * ID that is about to be replaced files it where nothing looks for it.
     */
    @action applyLayoutSettings = (settings: CatalogWidgetLayoutSettings | null | undefined, shownCatalogFileId?: number) => {
        if (!settings) {
            return;
        }
        if (typeof settings.widgetId === "string" && settings.widgetId) {
            this.widgetId = settings.widgetId;
        }
        if (typeof settings.tableSeparatorPosition === "string") {
            this.tableSeparatorPosition = settings.tableSeparatorPosition;
        }
        if (settings.headerTableColumnWidths?.length === CatalogWidgetStore.HeaderTableColumnCount && settings.headerTableColumnWidths.every(width => Number.isFinite(width))) {
            this.headerTableColumnWidths = [...settings.headerTableColumnWidths];
        }
        if (typeof settings.settingsTabId === "number") {
            this.setSettingsTab(shownCatalogFileId, settings.settingsTabId);
        }
    };
}
