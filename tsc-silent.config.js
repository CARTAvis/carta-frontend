const migratedFiles = [
    "utilities/array",
    "utilities/CatalogApiProcess",
    "utilities/color",
    "utilities/export",
    "utilities/fitting_heuristics",
    "utilities/math",
    "utilities/parsing",
    "utilities/Processed",
    "utilities/table"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};