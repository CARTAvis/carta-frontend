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
    "components/Dialogs/AboutDialog",
    "components/Dialogs/CodeSnippetDialog",
    "components/Dialogs/ContourDialog",
    "components/Dialogs/DraggableDialog",
    "components/Dialogs/ExternalPageDialog",
    "components/Dialogs/FileBrowser",
    "components/Dialogs/FileInfoDialog",
    "components/Dialogs/FittingDialog",
    "components/Dialogs/LayoutDialog",
    "components/Dialogs/OnlineQueryDialog",
    "components/Dialogs/PreferenceDialog",
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