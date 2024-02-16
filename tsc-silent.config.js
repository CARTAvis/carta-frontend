const migratedFiles = [
    "utilities",
    "models",
    "services/ApiService.ts",
    "services/BackendService.ts",
    "services/CatalogApiService.ts",
    "services/CatalogWebGLService.ts",
    "services/ContourWebGLService.ts",
    "services/ScriptingService.ts",
    "services/SplatalogueService.ts",
    "services/TelemetryService.ts"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};