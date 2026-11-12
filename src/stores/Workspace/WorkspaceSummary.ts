import {type Workspace} from "models";

/**
 * How each field of a workspace shows in the list of what else a workspace restores. A function
 * returns the name to show, or undefined when the workspace does not hold the setting. `null` means
 * that the field is not listed, because the dialog shows it in another place or it is not a setting.
 *
 * The type has every field of {@link Workspace}. A new field does not compile until it is added here.
 */
const RESTORED_SETTINGS: {[Field in keyof Required<Workspace>]: ((workspace: Workspace) => string | undefined) | null} = {
    id: null,
    name: null,
    editable: null,
    workspaceVersion: null,
    frontendVersion: null,
    description: null,
    files: null,
    catalogs: null,
    generatedImages: null,
    thumbnail: null,
    date: null,
    selectedFile: null,
    catalogMirrors: null,
    layout: workspace => (workspace.layout ? "Layout" : undefined),
    imageView: null,
    references: workspace => (workspace.references && Object.values(workspace.references).some(id => id !== undefined) ? "Image matching" : undefined),
    spectralMatchingType: null,
    colorBlendingImages: workspace => (workspace.colorBlendingImages?.length ? "Color blending" : undefined),
    selectedColorBlending: null,
    animator: workspace => (workspace.animator ? "Animator" : undefined),
    contourDataSource: null,
    cursor: workspace => (workspace.cursor?.frozen ? "Frozen cursor" : undefined),
    onlineCatalogQuery: workspace => (workspace.onlineCatalogQuery ? "Online catalog query" : undefined),
    openDialogs: workspace => (workspace.openDialogs?.length ? "Open dialogs" : undefined),
    openWidgetSettings: workspace => (workspace.openWidgetSettings?.length ? "Open settings panels" : undefined),
    catalogWidgets: workspace => (workspace.catalogWidgets && Object.keys(workspace.catalogWidgets).length ? "Catalog widgets" : undefined),
    plotWidgets: workspace => (workspace.plotWidgets && Object.keys(workspace.plotWidgets).length ? "Profile and analysis widgets" : undefined),
    imageFitting: workspace => (workspace.imageFitting ? "Image fitting" : undefined),
    wcsOverlay: workspace => (workspace.wcsOverlay ? "WCS overlay" : undefined)
};

/**
 * Returns the names of the settings that a workspace restores, besides its images, catalogs and
 * regions, such as "Layout" and "Contours". Only the settings that the workspace holds are named.
 */
export function describeRestoredSettings(workspace: Workspace): string[] {
    const names: string[] = [];
    const add = (name: string | undefined) => {
        if (name && !names.includes(name)) {
            names.push(name);
        }
    };
    const files = workspace.files ?? [];
    add(files.some(file => file.contourConfig?.levels?.length) ? "Contours" : undefined);
    add(files.some(file => file.vectorOverlayConfig) ? "Vector overlay" : undefined);
    for (const describe of Object.values(RESTORED_SETTINGS)) {
        add(describe?.(workspace));
    }
    return names;
}
