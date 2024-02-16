const migratedFiles = [
    "utilities",
    "models",
    "services/ApiService.ts",
    "services/BackendService.ts"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};