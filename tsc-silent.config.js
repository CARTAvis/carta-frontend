const migratedFiles = [
    "utilities",
    "models/AbstractCatalogProfile",
    "models/AngularSize",
    "models/CARTAInfo",
    "models/ChannelInfo",
    "models/CompressionQuality",
    "models/ControlMap"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};