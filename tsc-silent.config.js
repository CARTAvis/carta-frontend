const migratedFiles = [
    "utilities",
    "models",
    "services",
    "stores/HipsQueryStore/HipsQueryStore.ts"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};