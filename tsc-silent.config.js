const migratedFiles = [
    "utilities",
    "models/AbstractCatalogProfile",
    "models/AngularSize",
    "models/CARTAInfo",
    "models/ChannelInfo",
    "models/CompressionQuality",
    "models/ControlMap",
    "models/Cursor",
    "models/Event",
    "models/FileFilterMode",
    "models/FrameView",
    "models/Freq",
    "models/ImagePanelMode",
    "models/Layout",
    "models/MomentDefinition",
    "models/Point2D",
    "models/PolarizationDefinition",
    "models/RegionCreationMode",
    "models/Snippet",
    "models/Spectral",
    "models/StatisticsDefinition",
    "models/Theme",
    "models/Tile",
    "models/Transform2D",
    "models/TypeDefinition",
    "models/Wcs"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};