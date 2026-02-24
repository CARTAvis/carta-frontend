import {defineConfig} from "@rsbuild/core";
import {pluginEslint} from "@rsbuild/plugin-eslint";
import {pluginNodePolyfill} from "@rsbuild/plugin-node-polyfill";
import {pluginReact} from "@rsbuild/plugin-react";
import {pluginSass} from "@rsbuild/plugin-sass";
import {pluginGlsl} from "rsbuild-plugin-glsl";

export default defineConfig({
    plugins: [
        pluginEslint({
            enable: process.env.NODE_ENV === "production",
            eslintPluginOptions: {
                configType: "flat",
                eslintPath: "eslint/use-at-your-own-risk",
            },
        }),
        pluginReact(),
        pluginSass(),
        pluginNodePolyfill(),
        pluginGlsl()
    ],
    source: {
        decorators: {
            version: "legacy",
        },
        preEntry: "./src/setupGoldenLayout.ts",
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
        }
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
