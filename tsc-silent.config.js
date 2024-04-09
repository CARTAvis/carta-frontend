const migratedFiles = [
    "utilities",
    "models",
    "services",
    "stores/Widgets/CatalogWidget",
    "stores/Widgets/HistogramWidgetStore"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};