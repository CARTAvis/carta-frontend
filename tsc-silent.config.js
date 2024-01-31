const migratedFiles = [
    "utilities/array",
    "utilities/CatalogApiProcess"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};