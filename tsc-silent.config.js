const migratedFiles = [
    "utilities",
    "models",
    "services",
    "stores/AlertStore",
    "stores/AnimatorStore",
    "stores/Catalog",
    "stores/CatalogOnlineQuery",
    "stores/ChannelMapStore",
    "stores/DialogStore",
    "stores/FileBrowserStore",
    "stores/HelpStore",
    "stores/HipsQueryStore",
    "stores/ImageFittingStore",
    "stores/LayoutStore",
    "stores/LogStore",
    "stores/PreferenceStore",
    "stores/ProfileFittingStore",
    "stores/ProfileSmoothingStore",
    "stores/Snippet",
    "stores/SpatialProfileStore",
    "stores/SpectralProfileStore",
    "stores/Widgets",
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};