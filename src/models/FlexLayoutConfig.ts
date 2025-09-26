import * as FlexLayout from "flexlayout-react";

export class FlexLayoutConfig {
    static getDefaultConfig(): FlexLayout.IJsonModel {
        return {
            global: {
                tabEnableClose: true,
                tabEnableDrag: true,
                tabEnableRename: false,
                tabClassName: "carta-tab",
                borderClassName: "carta-border",
                splitterSize: 5,
                enableEdgeDock: true,
                tabEnablePopout: true
            },
            borders: [],
            layout: {
                type: "row",
                weight: 100,
                children: [
                    {
                        type: "column",
                        weight: 60,
                        children: [{
                            type: "tabset",
                            weight: 65,
                            children: [
                                {
                                    type: "tab",
                                    name: "Image Viewer",
                                    component: "image-view",
                                    id: "image-viewer",
                                    config: {
                                        id: "image-viewer",
                                        type: "image-view"
                                    }
                                }
                            ]
                        },
                            {
                                type: "tabset",
                                weight: 35,
                                children: [
                                    {
                                        type: "tab",
                                        name: "Render Config",
                                        component: "render-config",
                                        id: "render-config-0",
                                        config: {
                                            id: "render-config-0",
                                            type: "render-config"
                                        }
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        type: "column",
                        weight: 40,
                        children: [
                            {
                                type: "tabset",
                                // weight: 35,
                                children: [
                                    {
                                        type: "tab",
                                        name: "Spatial Profiler",
                                        component: "spatial-profiler",
                                        id: "spatial-profiler-0",
                                        config: {
                                            id: "spatial-profiler-0",
                                            type: "spatial-profiler"
                                        }
                                    }
                                ]
                            },
                            {
                                type: "tabset",
                                // weight: 35,
                                children: [
                                    {
                                        type: "tab",
                                        name: "spatial Profiler",
                                        component: "spatial-profiler",
                                        id: "spatial-profiler-1",
                                        config: {
                                            id: "spatial-profiler-1",
                                            type: "spatial-profiler"
                                        }
                                    }
                                ]
                            },
                            {
                                type: "tabset",
                                // weight: 30,
                                children: [
                                    {
                                        type: "tab",
                                        name: "Image List",
                                        component: "layer-list",
                                        id: "image-list-0",
                                        config: {
                                            id: "image-list-0",
                                            type: "image-list"
                                        }
                                    },
                                    {
                                        type: "tab",
                                        name: "Animator",
                                        component: "animator",
                                        id: "animator-0",
                                        config: {
                                            id: "animator-0",
                                            type: "animator"
                                        }
                                    },
                                    {
                                        type: "tab",
                                        name: "Region List",
                                        component: "region-list",
                                        id: "region-list-0",
                                        config: {
                                            id: "region-list-0",
                                            type: "region-list"
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        };
    }

    static createTabConfig(id: string, type: string, name: string, config: any = {}): FlexLayout.IJsonTabNode {
        return {
            type: "tab",
            id,
            name,
            component: type,
            config: {
                id,
                type,
                ...config
            }
        };
    }

    static createTabsetConfig(weight: number = 50, children: FlexLayout.IJsonTabNode[] = []): FlexLayout.IJsonTabSetNode {
        return {
            type: "tabset",
            weight,
            children
        };
    }

    static createRowConfig(weight: number = 100, children: any[] = []): FlexLayout.IJsonRowNode {
        return {
            type: "row",
            weight,
            children
        };
    }

    static createColumnConfig(weight: number = 100, children: any[] = []): FlexLayout.IJsonRowNode {
        return {
            type: "row",
            weight,
            children
        };
    }
}