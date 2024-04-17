const migratedFiles = [
    "utilities",
    "models",
    "services",
    "stores/Widgets"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};