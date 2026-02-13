import {defineConfig} from "@rsbuild/core";
import {pluginEslint} from '@rsbuild/plugin-eslint';
import {pluginNodePolyfill} from "@rsbuild/plugin-node-polyfill";
import {pluginReact} from "@rsbuild/plugin-react";
import {pluginSass} from "@rsbuild/plugin-sass";
import {pluginGlsl} from "rsbuild-plugin-glsl";

const defaultOptions = {
    extensions: ["js", "jsx", "ts", "tsx"],
    exclude: [
        "node_modules",
        "wasm_src",
        "docs_website",
        "protobuf"
    ],
    
};

export default defineConfig({
    plugins: [
        pluginReact(),
        pluginEslint({ eslintPluginOptions: defaultOptions }),
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
    server: {
        open: true,
    },
    output: {
        distPath: {
            root: "build"
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
