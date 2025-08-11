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
    "components/Dialogs/ContourDialog"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};