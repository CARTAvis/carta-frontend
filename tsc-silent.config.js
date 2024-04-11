const migratedFiles = [
    "utilities",
    "models",
    "services",
    "stores/Widgets/CatalogWidget",
    "stores/Widgets/HistogramWidgetStore",
    "stores/Widgets/LayerListWidgetStore",
    "stores/Widgets/PvGeneratorWidgetStore",
    "stores/Widgets/RegionWidgetStore",
    "stores/Widgets/RenderConfigWidgetStore"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};