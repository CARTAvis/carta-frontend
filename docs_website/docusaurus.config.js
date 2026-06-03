// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const {themes} = require("prism-react-renderer");
const path = require("path");
const versions = require("./versions.json");
const packageJson = require("../package.json");

const lightCodeTheme = themes.github;
const darkCodeTheme = themes.dracula;
const devVersion = packageJson.version;

const apiOnClick = `
    const versionLink = document.querySelector('.navbar__item.dropdown.dropdown--hoverable.dropdown--right .navbar__link');
    const currentVersion = versionLink?.textContent;
    let version = '';
    if (currentVersion) {
        if (currentVersion === 'Next' || currentVersion === '${devVersion}') {
            version = '/next';
        } else if (currentVersion !== '${versions?.[0]}') {
            version = '/' + currentVersion;
        }
    }
    
    window.location.href = '/carta-frontend/api' + version;
`;

const apiButton = `
    <a class="navbar__link menu__link api_link" onclick="${apiOnClick}">API</a>
`;

// eslint-disable-next-line tsdoc/syntax
/** @type {import('@docusaurus/types').Config} */
const config = {
    title: "CARTA Frontend Documentation",
    tagline: "Welcome to the CARTA frontend documentation",
    favicon: "img/carta_icon_128px.png",

    // Set the production url of your site here
    url: "https://cartavis.org",
    // Set the /<baseUrl>/ pathname under which your site is served
    // For GitHub pages deployment, it is often '/<projectName>/'
    baseUrl: "/carta-frontend",

    // GitHub pages deployment config.
    // If you aren't using GitHub pages, you don't need these.
    organizationName: "CARTAvis", // Usually your GitHub org/user name.
    projectName: "carta-frontend", // Usually your repo name.
    trailingSlash: false,

    onBrokenLinks: "warn",

    markdown: {
        hooks: {
            onBrokenMarkdownLinks: "warn"
        }
    },

    // Even if you don't use internalization, you can use this field to set useful
    // metadata like html lang. For example, if your site is Chinese, you may want
    // to replace "en" with "zh-Hans".
    i18n: {
        defaultLocale: "en",
        locales: ["en"]
    },

    presets: [
        [
            "classic",
            // eslint-disable-next-line tsdoc/syntax
            /** @type {import('@docusaurus/preset-classic').Options} */
            ({
                docs: {
                    versions: {
                        current: {
                            label: devVersion
                        },
                        "5.0.0": {
                            banner: "none"
                        }
                    },
                    sidebarPath: require.resolve("./sidebars.js")
                },
                theme: {
                    customCss: require.resolve("./src/css/custom.css")
                }
            })
        ]
    ],

    themeConfig:
        // eslint-disable-next-line tsdoc/syntax
        /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
        ({
            navbar: {
                title: "CARTA Frontend Documentation",
                logo: {
                    alt: "CARTA Logo",
                    src: "img/carta_icon_128px.png"
                },
                items: [
                    {
                        type: "docSidebar",
                        sidebarId: "docsSidebar",
                        position: "left",
                        label: "Docs"
                    },
                    {
                        type: "html",
                        position: "left",
                        value: apiButton,
                        className: "navbar__link"
                    },
                    {
                        type: "docsVersionDropdown",
                        position: "right",
                        dropdownActiveClassDisabled: true
                    },
                    {
                        href: "https://github.com/CARTAvis/carta-frontend",
                        label: "GitHub",
                        position: "right"
                    }
                ]
            },
            footer: {
                style: "dark",
                copyright: `Copyright © ${new Date().getFullYear()} CARTA development team. Built with Docusaurus.`
            },
            prism: {
                theme: lightCodeTheme,
                darkTheme: darkCodeTheme
            }
        }),

    plugins: [
        [
            "@loveluthien/docusaurus-plugin-typedoc-api",
            {
                projectRoot: path.join(__dirname, ".."),
                packages: [
                    {
                        path: ".",
                        entry: {
                            index: {path: "src/index.tsx", entry: "."}, // index.tsx has no exports; work-around for displaying the overview page
                            components: {path: "src/components/index.ts", entry: ".", label: "Components"},
                            "components/Dialogs": {path: "src/components/Dialogs/index.ts", entry: ".", label: "Components - Dialogs"},
                            "components/Shared": {path: "src/components/Shared/index.ts", entry: ".", label: "Components - Shared"},
                            enums: {path: "src/enums/index.ts", entry: ".", label: "Enums"},
                            models: {path: "src/models/index.ts", entry: ".", label: "Models"},
                            services: {path: "src/services/index.ts", entry: ".", label: "Services"},
                            stores: {path: "src/stores/index.ts", entry: ".", label: "Stores"},
                            utilities: {path: "src/utilities/index.ts", entry: ".", label: "Utilities"}
                        }
                    }
                ],
                readmes: true,
                readmeName: "docs_website/api/api.md",
                changelogs: true,
                tsconfigName: "tsconfig.json"
            }
        ],
        require.resolve("docusaurus-lunr-search"),
        // Custom plugin to deduplicate @docusaurus packages.
        // The typedoc-api plugin has its own copies of @docusaurus/* in node_modules,
        // which causes React context failures during SSR (DocsVersionProvider, TitleFormatterProvider)
        // because each package's React context gets two separate instances in the webpack bundle.
        // We fix this by telling webpack to resolve all modules from docs_website's node_modules first.
        function deduplicateDocusaurusPackages() {
            return {
                name: "deduplicate-docusaurus-packages",
                configureWebpack() {
                    return {
                        mergeStrategy: {
                            "resolve.modules": "replace"
                        },
                        resolve: {
                            // Prepend docs_website's node_modules to ensure all packages
                            // resolve here first, preventing duplicates from plugin's own copies.
                            modules: [path.resolve(__dirname, "node_modules"), "node_modules"]
                        }
                    };
                }
            };
        }
    ]
};

module.exports = config;
