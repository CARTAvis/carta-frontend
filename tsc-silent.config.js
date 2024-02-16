const migratedFiles = [
    "utilities",
    "models",
    "services/ApiService.ts"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};