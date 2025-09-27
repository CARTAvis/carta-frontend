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
        pluginEslint({ eslintPluginOptions: defaultOptions, enable: process.env.NODE_ENV === "production" }),
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
    output: {
        distPath: {
            root: "build"
        }
    },
    html: {
        favicon: "./public/carta_icon_128px.png",
        title: "CARTA"
    },
    tools: {
        rspack: {
            resolveLoader: {
                alias: {
                    "worker-loader": require.resolve("worker-rspack-loader"),
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