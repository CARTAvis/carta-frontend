const migratedFiles = [
    "utilities",
    "models",
    "services",
    "stores",
    "App.tsx",
    "components"
];

module.exports = {
    suppress: [
        {
            pathRegExp: `/src/(?!${migratedFiles.join("|")})`,
            codes: []
        }
    ],
};