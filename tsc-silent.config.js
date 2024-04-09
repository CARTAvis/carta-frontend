const migratedFiles = [
    "utilities",
    "models",
    "services",
    "stores/Widgets/CatalogWidget"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};