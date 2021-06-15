export class PresetLayout {
    public static readonly DEFAULT = "Default";
    public static readonly CUBEVIEW = "Cube View";
    public static readonly CUBEANALYSIS = "Cube Analysis";
    public static readonly CONTINUUMANALYSIS = "Continuum Analysis";
    public static readonly PRESETS = [PresetLayout.DEFAULT, PresetLayout.CUBEVIEW, PresetLayout.CUBEANALYSIS, PresetLayout.CONTINUUMANALYSIS];
    public static readonly PRESET_CONFIGS = new Map<string, any>([
        [
            PresetLayout.DEFAULT,
            {
                leftBottomContent: {
                    type: "stack",
                    content: [{type: "component", id: "render-config"}]
                },
                rightColumnContent: [
                    {type: "component", id: "spatial-profiler", widgetSettings: {coordinate: "x"}},
                    {type: "component", id: "spatial-profiler", widgetSettings: {coordinate: "y"}},
                    {
                        type: "stack",
                        content: [
                            {type: "component", id: "layer-list"},
                            {type: "component", id: "animator"},
                            {type: "component", id: "region-list"}
                        ]
                    }
                ]
            }
        ],
        [
            PresetLayout.CUBEVIEW,
            {
                leftBottomContent: {
                    type: "stack",
                    content: [
                        {type: "component", id: "animator"},
                        {type: "component", id: "render-config"},
                        {type: "component", id: "region-list"},
                        {type: "component", id: "layer-list"}
                    ]
                },
                rightColumnContent: [
                    {type: "component", id: "spatial-profiler", widgetSettings: {coordinate: "x"}},
                    {type: "component", id: "spatial-profiler", widgetSettings: {coordinate: "y"}},
                    {type: "component", id: "spectral-profiler"}
                ]
            }
        ],
        [
            PresetLayout.CUBEANALYSIS,
            {
                leftBottomContent: {
                    type: "stack",
                    content: [
                        {type: "component", id: "animator"},
                        {type: "component", id: "render-config"},
                        {type: "component", id: "region-list"},
                        {type: "component", id: "layer-list"}
                    ]
                },
                rightColumnContent: [
                    {type: "component", id: "spectral-profiler"},
                    {type: "component", id: "stats"}
                ]
            }
        ],
        [
            PresetLayout.CONTINUUMANALYSIS,
            {
                leftBottomContent: {
                    type: "stack",
                    content: [
                        {type: "component", id: "render-config"},
                        {type: "component", id: "region-list"},
                        {type: "component", id: "animator"},
                        {type: "component", id: "layer-list"}
                    ]
                },
                rightColumnContent: [
                    {type: "component", id: "spatial-profiler", widgetSettings: {coordinate: "x"}},
                    {type: "component", id: "spatial-profiler", widgetSettings: {coordinate: "y"}},
                    {type: "component", id: "stats"}
                ]
            }
        ]
    ]);

    public static isPreset = (layoutName: string): boolean => {
        return layoutName && PresetLayout.PRESETS.includes(layoutName);
    };
}
