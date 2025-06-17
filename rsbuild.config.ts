import {defineConfig} from '@rsbuild/core';
import {pluginReact} from '@rsbuild/plugin-react';
import {pluginSass} from '@rsbuild/plugin-sass';
import {pluginNodePolyfill} from "@rsbuild/plugin-node-polyfill";
import {pluginGlsl} from 'rsbuild-plugin-glsl';

export default defineConfig({
    plugins: [pluginReact(), pluginSass(), pluginNodePolyfill(), pluginGlsl()],
    source: {
        decorators: {
            version: 'legacy',
        },
        preEntry: "./src/setupGoldenLayout.ts"
    },
    output: {
        distPath: {
            root: "build"
        }
    },
    tools: {
        rspack: {
            resolveLoader: {
                alias: {
                    'worker-loader': require.resolve('worker-rspack-loader'),
                },
            },
            module: {
                rules: [
                    {
                        test: /\.worker\.js$/,
                        loader: 'worker-rspack-loader',
                    },
                ],
            },
        },
    },
});