const migratedFiles = [
    "utilities",
    "models",
    "services",
    "stores/Widgets",
    "stores/SpectralProfileStore"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};