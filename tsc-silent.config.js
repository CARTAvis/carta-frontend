const migratedFiles = [
    "utilities",
    "models",
    "services",
    "stores/Widgets",
    "stores/SpectralProfileStore",
    "stores/SpatialProfileStore",
    "stores/Snippet",
    "stores/ProfileSmoothingStore",
    "stores/ProfileFittingStore",
    "stores/LogStore",
    "stores/LayoutStore",
    "stores/ImageFittingStore"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};