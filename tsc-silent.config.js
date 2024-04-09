const migratedFiles = [
    "utilities",
    "models",
    "services",
    "stores/Widgets/CatalogWidget/CatalogPlotWidgetStore"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};