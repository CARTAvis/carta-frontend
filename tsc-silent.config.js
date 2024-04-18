const migratedFiles = [
    "utilities",
    "models",
    "services",
    "stores/Widgets",
    "stores/SpectralProfileStore",
    "stores/SpatialProfileStore",
    "stores/Snippet",
    "stores/ProfileSmoothingStore",
    "stores/ProfileFittingStore"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};