const migratedFiles = [
    "utilities",
    "models/AbstractCatalogProfile"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};