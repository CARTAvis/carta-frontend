import {type IJsonModel, type IJsonRowNode, type IJsonTabNode, type IJsonTabSetNode} from "flexlayout-react";

import {smoothStepOffset} from "utilities/math/math";

/** Global settings for the FlexLayout model */
const FLEXLAYOUT_GLOBAL_CONFIG = {
    tabEnableClose: true,
    tabEnableRename: false,
    tabSetEnableMaximize: true,
    tabSetEnableTabStrip: true,
    tabSetMinWidth: 250,
    tabSetMinHeight: 200,
    splitterSize: 4,
    splitterExtra: 4,
    tabEnablePopout: false,
    tabSetEnableClose: false,
    tabSetEnableDeleteWhenEmpty: true,
    tabEnableRenderOnDemand: true
};

/** Map of widget type strings to their default FlexLayout tab node JSON */
const COMPONENT_CONFIG = new Map<string, IJsonTabNode>([
    [
        "image-view",
        {
            type: "tab",
            component: "image-view",
            name: "No image loaded",
            id: "image-view",
            enableClose: false,
            enableDrag: false
        }
    ],
    ["render-config", {type: "tab", component: "render-config", name: "Render Configuration", id: "render-config"}],
    ["region-list", {type: "tab", component: "region-list", name: "Region List", id: "region-list"}],
    ["animator", {type: "tab", component: "animator", name: "Animator", id: "animator"}],
    ["spatial-profiler", {type: "tab", component: "spatial-profiler", id: "spatial-profiler"}],
    ["spectral-profiler", {type: "tab", component: "spectral-profiler", id: "spectral-profiler", name: "Z Profile: Cursor"}],
    ["stokes", {type: "tab", component: "stokes", id: "stokes", name: "Stokes Analysis"}],
    ["histogram", {type: "tab", component: "histogram", name: "Histogram", id: "histogram"}],
    ["stats", {type: "tab", component: "stats", name: "Statistics", id: "stats"}],
    ["layer-list", {type: "tab", component: "layer-list", name: "Image List", id: "layer-list"}],
    ["log", {type: "tab", component: "log", name: "Log", id: "log"}],
    ["catalog-overlay", {type: "tab", component: "catalog-overlay", name: "Catalog Overlay", id: "catalog-overlay"}],
    ["catalog-plot", {type: "tab", component: "catalog-plot", name: "Catalog Plot", id: "catalog-plot"}],
    ["spectral-line-query", {type: "tab", component: "spectral-line-query", name: "Spectral Line Query", id: "spectral-line-query"}],
    ["cursor-info", {type: "tab", component: "cursor-info", name: "Cursor Info", id: "cursor-info"}],
    ["pv-generator", {type: "tab", component: "pv-generator", name: "PV Generator", id: "pv-generator"}],
    ["pv-preview", {type: "tab", component: "pv-preview", name: "PV Preview", id: "pv-preview"}],
    ["placeholder", {type: "tab", component: "placeholder", name: "Placeholder", id: "placeholder"}],
    ["channel-map-control", {type: "tab", component: "channel-map-control", name: "Channel Map", id: "channel-map-control"}]
]);

/**
 * Gets the default FlexLayout tab JSON for a widget type.
 * Returns a shallow copy so callers can modify it safely.
 */
export function getComponentTabJson(widgetType: string): IJsonTabNode | undefined {
    const config = COMPONENT_CONFIG.get(widgetType);
    return config ? {...config} : undefined;
}

/**
 * Converts the app's abstract layout config (rows/columns/stacks/components)
 * into a FlexLayout IJsonModel that can be passed to Model.fromJson().
 *
 * The abstract config uses GL-style terminology:
 * - type: "row" | "column" | "stack" | "component"
 * - content: children array
 * - width/height: percentage weights
 *
 * FlexLayout terminology:
 * - "row" node with children (IJsonRowNode)
 * - "tabset" node with tab children (IJsonTabSetNode)
 * - "tab" leaf node (IJsonTabNode)
 * - weight: relative sizing (defaults to 100)
 */
export function createFlexLayoutModel(dockedConfig: any): IJsonModel {
    // Reset ID tracking for this model creation
    usedIds.clear();
    idCounters.clear();
    const layoutNode = convertNode(dockedConfig);
    return {
        global: FLEXLAYOUT_GLOBAL_CONFIG,
        borders: [],
        layout: layoutNode as IJsonRowNode
    };
}

/**
 * Get the default image-view height weight based on window dimensions.
 * Matches the original GL behavior.
 */
export function getImageViewWeight(): number {
    return smoothStepOffset(window.innerHeight, 720, 1080, 65, 75);
}

/** Track used IDs during a single createFlexLayoutModel() call to ensure uniqueness */
const usedIds = new Set<string>();
const idCounters = new Map<string, number>();

/**
 * Gets a unique ID for a widget node. If the ID is already used (e.g., two
 * "spatial-profiler" in a preset), auto-suffixes with "-0", "-1", etc.
 */
function getUniqueId(baseId: string): string {
    // If it already has a numeric suffix (e.g., "spatial-profiler-0"), use as-is if unique
    if (!usedIds.has(baseId)) {
        usedIds.add(baseId);
        return baseId;
    }

    // Strip existing numeric suffix to get the type base
    const typeBase = baseId.replace(/-\d+$/, "");
    const counter = idCounters.get(typeBase) ?? 0;

    // Find next available
    let idx = counter;
    let candidate = `${typeBase}-${idx}`;
    while (usedIds.has(candidate)) {
        idx++;
        candidate = `${typeBase}-${idx}`;
    }
    idCounters.set(typeBase, idx + 1);
    usedIds.add(candidate);
    return candidate;
}

function convertNode(node: any): IJsonRowNode | IJsonTabSetNode | IJsonTabNode {
    if (!node || !node.type) {
        return {type: "row", children: []} as IJsonRowNode;
    }

    switch (node.type) {
        case "row":
            return convertRowOrColumn(node, false);
        case "column":
            return convertRowOrColumn(node, true);
        case "stack":
            return convertStack(node);
        case "component":
            return convertComponent(node);
        default:
            return {type: "row", children: []} as IJsonRowNode;
    }
}

function convertRowOrColumn(node: any, isVertical: boolean): IJsonRowNode {
    // In FlexLayout, a "row" lays out children horizontally by default.
    // GL's "column" lays out children vertically, which is a FlexLayout "row"
    // that is a child inside a parent row (FlexLayout handles orientation via nesting).
    // We use the same "row" type but rely on FlexLayout's automatic alternating orientation.
    const children: (IJsonRowNode | IJsonTabSetNode)[] = [];
    const content = node.content || [];

    for (const child of content) {
        const converted = convertNode(child);
        if (converted.type === "tab") {
            // Wrap bare tabs in a tabset
            const tabset: IJsonTabSetNode = {
                type: "tabset",
                children: [converted as IJsonTabNode],
                weight: child.weight || child.width || child.height || 100
            };
            children.push(tabset);
        } else {
            // Propagate weight from the abstract config
            if (child.width || child.height) {
                (converted as any).weight = child.width || child.height;
            }
            children.push(converted as IJsonRowNode | IJsonTabSetNode);
        }
    }

    return {
        type: "row",
        weight: node.width || node.height || 100,
        children
    } as IJsonRowNode;
}

function convertStack(node: any): IJsonTabSetNode {
    const children: IJsonTabNode[] = [];
    const content = node.content || [];

    for (const child of content) {
        const converted = convertNode(child);
        if (converted.type === "tab") {
            children.push(converted as IJsonTabNode);
        }
    }

    const tabset: IJsonTabSetNode = {
        type: "tabset",
        children,
        weight: node.width || node.height || 100
    };

    if (node.activeItemIndex !== undefined && node.activeItemIndex >= 0 && node.activeItemIndex < children.length) {
        tabset.selected = node.activeItemIndex;
    }

    return tabset;
}

function convertComponent(node: any): IJsonTabNode {
    const widgetType = node.id?.replace(/-\d+$/, "") || node.id;
    const templateConfig = COMPONENT_CONFIG.get(widgetType);

    if (!templateConfig) {
        return {
            type: "tab",
            component: "placeholder",
            name: `Unknown: ${node.id}`,
            id: node.id
        };
    }

    const tabNode: IJsonTabNode = {...templateConfig};

    // Assign a unique ID — handles both saved layouts ("spatial-profiler-0")
    // and presets where multiple components share the same base id ("spatial-profiler")
    const uniqueId = getUniqueId(node.id);
    tabNode.id = uniqueId;
    // Store the assigned ID back so callers (e.g., initWidgets) can use it
    node._assignedId = uniqueId;

    // Also store the widget ID in config so the factory can find the widget store
    tabNode.config = {...(tabNode.config || {}), id: uniqueId};

    // Apply the image-view special height
    if (widgetType === "image-view") {
        tabNode.config = {...(tabNode.config || {}), imageViewWeight: getImageViewWeight()};
    }

    // Carry over widget settings and plot type into config
    if (node.widgetSettings) {
        tabNode.config = {...(tabNode.config || {}), widgetSettings: node.widgetSettings};
    }
    if (node.plotType) {
        tabNode.config = {...(tabNode.config || {}), plotType: node.plotType};
    }

    return tabNode;
}

/**
 * Walks a FlexLayout model JSON and extracts the abstract config for saving.
 * This is the reverse of createFlexLayoutModel().
 */
export function extractAbstractConfig(modelJson: IJsonModel): {type: string; content: any[]} {
    return extractNode(modelJson.layout);
}

function extractNode(node: any): any {
    if (!node) {
        return null;
    }

    if (node.type === "row") {
        return extractRowNode(node);
    } else if (node.type === "tabset") {
        return extractTabSetNode(node);
    } else if (node.type === "tab") {
        return extractTabNode(node);
    }
    return null;
}

function extractRowNode(node: any): any {
    const children = node.children || [];
    const result: any = {
        // always save as "row" in the abstract format and let convertNode handle the "row"/"column" conversion
        type: "row",
        content: []
    };

    if (node.weight && node.weight !== 100) {
        result.width = node.weight;
    }

    for (const child of children) {
        const extracted = extractNode(child);
        if (extracted) {
            // Propagate weight as width
            if (child.weight && child.weight !== 100) {
                extracted.width = child.weight;
            }
            result.content.push(extracted);
        }
    }

    return result;
}

function extractTabSetNode(node: any): any {
    const children = node.children || [];
    const result: any = {
        type: "stack",
        content: []
    };

    if (node.weight && node.weight !== 100) {
        result.width = node.weight;
    }

    if (node.selected !== undefined && node.selected > 0) {
        result.activeItemIndex = node.selected;
    }

    for (const child of children) {
        const extracted = extractTabNode(child);
        if (extracted) {
            result.content.push(extracted);
        }
    }

    return result;
}

function extractTabNode(node: any): any {
    if (!node || node.type !== "tab") {
        return null;
    }

    // Strip numeric suffix from ID to get the base widget type
    const id = node.id || node.component;
    const widgetType = id?.replace(/(-component)?-\d+$/, "") || id;

    const result: any = {
        type: "component",
        id: widgetType
    };

    // Preserve original instance ID so EnrichSaveConfig can look up per-instance widget stores
    if (id !== widgetType) {
        result._instanceId = id;
    }

    // Extract widget settings from config
    if (node.config?.widgetSettings) {
        result.widgetSettings = node.config.widgetSettings;
    }

    if (node.config?.plotType) {
        result.plotType = node.config.plotType;
    }

    return result;
}
