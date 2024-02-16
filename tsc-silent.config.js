const migratedFiles = [
    "utilities",
    "models",
    "services/ApiService.ts",
    "services/BackendService.ts",
    "services/CatalogApiService.ts",
    "services/CatalogWebGLService.ts"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};