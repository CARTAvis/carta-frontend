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
    "stores/ImageFittingStore",
    "stores/HelpStore",
    "stores/FileBrowserStore",
    "stores/DialogStore",
    "stores/CatalogOnlineQuery",
    "stores/Catalog",
    "stores/AlertStore",
    "stores/HipsQueryStore",
    "stores/ChannelMapStore"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};