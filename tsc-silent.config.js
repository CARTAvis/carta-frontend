const migratedFiles = [
    "utilities/array",
    "utilities/CatalogApiProcess",
    "utilities/color",
    "utilities/export"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};