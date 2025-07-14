const migratedFiles = [
    "utilities",
    "models",
    "services",
    "stores/AlertStore",
    "stores/AnimatorStore",
    "stores/Catalog",
    "stores/CatalogOnlineQuery",
    "stores/ChannelMapStore",
    "stores/ColorBlendingStore",
    "stores/DialogStore",
    "stores/DynamicLayoutStore",
    "stores/FileBrowserStore",
    "stores/HelpStore",
    "stores/HipsQueryStore",
    "stores/ImageFittingStore",
    "stores/ImageViewConfigStore",
    "stores/LayoutStore",
    "stores/LogStore",
    "stores/PreferenceStore",
    "stores/ProfileFittingStore",
    "stores/ProfileSmoothingStore",
    "stores/Snippet",
    "stores/SpatialProfileStore",
    "stores/SpectralProfileStore",
    "stores/Widgets",
    "stores/Frame"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};