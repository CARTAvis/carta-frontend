import {defineConfig} from '@rsbuild/core';
import {pluginReact} from '@rsbuild/plugin-react';
import {pluginSass} from '@rsbuild/plugin-sass';
import {pluginNodePolyfill} from "@rsbuild/plugin-node-polyfill";
import {pluginGlsl} from 'rsbuild-plugin-glsl';

export default defineConfig({
    plugins: [pluginReact(), pluginSass(), pluginNodePolyfill(), pluginGlsl()],
});