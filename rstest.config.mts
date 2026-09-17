import {resolve} from "node:path";

import {withRsbuildConfig} from "@rstest/adapter-rsbuild";
import {defineConfig} from "@rstest/core";

const fromRoot = (path: string) => resolve(import.meta.dirname, path);

export default defineConfig({
    extends: withRsbuildConfig({
        modifyRsbuildConfig: config => ({
            ...config,
            plugins: config.plugins?.filter(plugin => plugin.name !== "rsbuild:eslint")
        })
    }),
    clearMocks: true,
    globals: true,
    include: ["src/**/*.{test,spec}.{js,jsx,ts,tsx}", "wasm_src/**/*.{test,spec}.{js,jsx,ts,tsx}"],
    setupFiles: ["./src/setupRstest.js"],
    testEnvironment: "jsdom",
    coverage: {
        provider: "v8",
        include: ["src/**/*.{js,jsx,ts,tsx}"],
        exclude: ["src/**/*.d.ts", "src/index.tsx", "src/registerServiceWorker.ts", "src/setup*.js"]
    },
	resolve: {
		alias: {
			ast_wrapper: fromRoot("src/__mocks__/ast_wrapper.js"),
			"carta-protobuf": fromRoot("protobuf/build"),
			carta_computation: fromRoot("src/__mocks__/carta_computation.js"),
            gsl_wrapper: fromRoot("src/__mocks__/gsl_wrapper.js"),
            zfp_wrapper: fromRoot("src/__mocks__/ZFPWorkerMock.js"),
            "carta-schemas": fromRoot("schemas")
        }
    }
});
