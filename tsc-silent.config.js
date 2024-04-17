const migratedFiles = [
    "utilities",
    "models",
    "services",
    "stores/Widgets",
    "stores/SpectralProfileStore",
    "stores/SpatialProfileStore",
    "stores/Snippet"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};