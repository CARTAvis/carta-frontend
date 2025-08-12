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
    "components/Shared/AnnotationMenuComponent",
    "components/Shared/AutoColorComponent",
    "components/Shared/BiasContrastSelectComponent",
    "components/Shared/ColorMapComponent",
    "components/Shared/CoordNumericInputComponent",
    "components/Shared/PlotContainerComponent",
    "components/Shared/LinePlotSettingPanelComponent",
    "components/Shared/Tables",
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