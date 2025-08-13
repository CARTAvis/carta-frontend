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
    "components/HelpDrawer",
    "components/Histogram",
    "components/ImageView",
    "components/LayerList",
    "components/Log",
    "components/Menu",
    "components/Placeholder",
    "components/PvGenerator",
    "components/RegionList",
    "components/RegionConfig",
    "components/Shared",
    "components/SpectralProfile",
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