const migratedFiles = [
    "utilities/array",
    "utilities/CatalogApiProcess",
    "utilities/color"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};