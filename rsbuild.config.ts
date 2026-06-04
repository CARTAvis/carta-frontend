import {defineConfig} from "@rsbuild/core";
import {pluginEslint} from "@rsbuild/plugin-eslint";
import {pluginNodePolyfill} from "@rsbuild/plugin-node-polyfill";
import {pluginReact} from "@rsbuild/plugin-react";
import {pluginSass} from "@rsbuild/plugin-sass";
import {pluginTypeCheck} from '@rsbuild/plugin-type-check';
import {pluginGlsl} from "rsbuild-plugin-glsl";

export default defineConfig({
    plugins: [
        pluginEslint({
            enable: true,
            eslintPluginOptions: {
                cache: false,
                configType: "flat",
            },
        }),
        pluginReact(),
        pluginSass(),
        pluginNodePolyfill(),
        pluginGlsl(),
        pluginTypeCheck()
    ],
    source: {
        decorators: {
            version: "legacy",
        },
        define: {
            'process.env.BUILD_DATE': JSON.stringify(new Date().toISOString()),
        },
    },
    dev: {
        lazyCompilation: false,
    },
    output: {
        distPath: {
            root: "build"
        },
        assetPrefix: "auto"
    },
    server: {
        open: true,
        port: 3000,
        host: "localhost"
    },
    performance: {
        chunkSplit: {
            strategy: "split-by-size"
        }
    },
    html: {
        template: "./public/index.html",
        title: "CARTA",
    },
    tools: {
        rspack: {
            ignoreWarnings: [
                {
                    module: /protobufjs.*inquire/,
                    message: /Critical dependency: the request of a dependency is an expression/,
                },
            ],
            node: {
                __filename: false,
                __dirname: false,
            },
            resolveLoader: {
                alias: {
                    "worker-loader": "worker-rspack-loader",
                },
            },
            module: {
                rules: [
                    {
                        test: /\.worker\.js$/,
                        loader: "worker-rspack-loader",
                    },
                ],
            },
        },
    },
});
