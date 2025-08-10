const migratedFiles = [
    "utilities",
    "models",
    "services",
    "stores"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};