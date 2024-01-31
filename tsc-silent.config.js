const migratedFiles = [
    "utilities/array",
    "utilities/CatalogApiProcess",
    "utilities/color",
    "utilities/export",
    "utilities/fitting_heuristics"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};