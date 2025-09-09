import {defineConfig} from "@rsbuild/core";
import {pluginReact} from "@rsbuild/plugin-react";
import {pluginSass} from "@rsbuild/plugin-sass";
import {pluginNodePolyfill} from "@rsbuild/plugin-node-polyfill";
import {pluginGlsl} from "rsbuild-plugin-glsl";

export default defineConfig({
    plugins: [pluginReact(), pluginSass(), pluginNodePolyfill(), pluginGlsl()],
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