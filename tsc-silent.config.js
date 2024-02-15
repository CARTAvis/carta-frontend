const migratedFiles = [
    "utilities",
    "models/AbstractCatalogProfile",
    "models/AngularSize",
    "models/CARTAInfo",
    "models/ChannelInfo",
    "models/CompressionQuality",
    "models/ControlMap",
    "models/Cursor"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};