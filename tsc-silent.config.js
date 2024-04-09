const migratedFiles = [
    "utilities",
    "models",
    "services",
    "stores/Widgets/CatalogWidget",
    "stores/Widgets/HistogramWidgetStore",
    "stores/Widgets/LayerListWidgetStore",
    "stores/Widgets/PvGeneratorWidgetStore"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};