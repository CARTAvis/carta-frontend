const migratedFiles = [
    "utilities",
    "models",
    "services",
    "stores",
    "App.tsx",
    "components/Animator",
    "components/App",
    "components/CatalogOverlay",
    "components/ChannelMapControl",
    "components/CursorInfo",
    "components/Dialogs",
    "components/FileInfo",
    "components/FloatingWidget",
    "components/FloatingWidgetManager",
    "components/Shared",
    "components/SpectralLineQuery"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};