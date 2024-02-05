const migratedFiles = [
    "utilities/array",
    "utilities/CatalogApiProcess",
    "utilities/color",
    "utilities/export",
    "utilities/fitting_heuristics",
    "utilities/math",
    "utilities/parsing",
    "utilities/Processed",
    "utilities/table",
    "utilities/templates",
    "utilities/tiling",
    "utilities/units",
    "utilities/wcs"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};