const migratedFiles = [
    "utilities",
    "models/AbstractCatalogProfile",
    "models/AngularSize"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};