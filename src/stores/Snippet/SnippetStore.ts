import {action, computed, flow, makeObservable, observable} from "mobx";

import {AppToaster, SuccessToast} from "components/Shared";
import {Snippet} from "models";
import {ApiService} from "services";
import {AlertStore} from "stores";

import {EXAMPLE_SNIPPETS} from "./ExampleSnippets";

// AsyncFunction is not a global; get its constructor from an async function expression (per MDN), once
const AsyncFunction = async function () {}.constructor as FunctionConstructor;

export class SnippetStore {
    private static staticInstance: SnippetStore;

    public static get Instance() {
        if (!SnippetStore.staticInstance) {
            SnippetStore.staticInstance = new SnippetStore();
        }
        return SnippetStore.staticInstance;
    }

    public static readonly TOASTER_TIMEOUT = 1500;

    @observable snippets: Map<string, Snippet> = new Map<string, Snippet>();
    @observable activeSnippet: Snippet = {
        code: "",
        frontendVersion: undefined as any,
        snippetVersion: undefined as any,
        categories: []
    };
    @observable activeSnippetName: string | undefined = "";
    @observable isExecuting: boolean = false;

    private constructor() {
        makeObservable(this);
        this.setDefaultSnippets();
        this.clearActiveSnippet();
    }

    public snippetExists = (name: string): boolean => {
        return name.length > 0 && this.snippets.has(name);
    };

    @action setDefaultSnippets = () => {
        if (!this.snippets) {
            this.snippets = new Map<string, Snippet>();
        }
        this.snippets.clear();
        for (const example of EXAMPLE_SNIPPETS) {
            let category = "Examples";
            if (example.section) {
                category += `/${example.section}`;
            }

            const snippet: Snippet = {
                tags: ["example"],
                categories: [category],
                code: example.code,
                frontendVersion: Snippet.FRONTEND_VERSION,
                snippetVersion: Snippet.SNIPPET_VERSION
            };

            this.snippets.set(example.name, snippet);
        }
    };

    @flow.bound *fetchSnippets() {
        this.setDefaultSnippets();

        try {
            const userSnippets = yield ApiService.Instance.getSnippets();
            for (const [name, snippet] of userSnippets) {
                this.snippets.set(name, snippet);
            }
            const previousSnippet = this.snippets.get("_previous");
            if (previousSnippet) {
                this.setActiveSnippet(previousSnippet, "");
            }
        } catch (err) {
            AlertStore.Instance.showAlert("Loading user-defined snippets failed!");
            console.error(err);
        }
    }

    @computed get numSavedSnippets(): number {
        return this.snippets.size;
    }

    @computed get isInputValid() {
        return this.functionToExecute !== undefined;
    }

    // Compile snippet source to an async function; the "parameters" arg exposes URL-supplied args to the snippet body
    private compileSnippet = (code: string | undefined): Function | undefined => {
        if (code === undefined || code === null) {
            return undefined;
        }
        try {
            return new AsyncFunction("parameters", code);
        } catch (e) {
            console.error(e);
            return undefined;
        }
    };

    @computed
    private get functionToExecute() {
        return this.compileSnippet(this.activeSnippet?.code);
    }

    @action setActiveSnippet = (snippet: Snippet, name: string | undefined) => {
        this.activeSnippet = {...snippet};
        if (!this.activeSnippet.categories) {
            this.activeSnippet.categories = [];
        }

        this.activeSnippet.categories = this.activeSnippet.categories.filter(c => c !== "hidden");

        if (snippet.tags?.includes("example")) {
            this.activeSnippetName = "";
        } else {
            this.activeSnippetName = name;
        }
    };

    @action clearActiveSnippet = () => {
        this.activeSnippet = {
            code: "",
            frontendVersion: Snippet.FRONTEND_VERSION,
            snippetVersion: Snippet.FRONTEND_VERSION,
            categories: []
        };
        this.activeSnippetName = "";
    };

    @action setSnippetString = (val: string) => {
        if (!this.activeSnippet) {
            this.clearActiveSnippet();
        }
        this.activeSnippet.code = val;
    };

    @flow.bound *saveSnippet(name: string, snippet: Snippet, isSilent: boolean = false) {
        this.snippets.set(name, snippet);

        try {
            const success = yield ApiService.Instance.setSnippet(name, snippet);
            if (success) {
                // Silently exit on success if silent flag is set
                if (!isSilent) {
                    AppToaster.show(SuccessToast("console", `Snippet ${name} saved successfully.`, SnippetStore.TOASTER_TIMEOUT));
                }
                return true;
            } else {
                AlertStore.Instance.showAlert(`Saving snippet ${name} failed!`);
                return false;
            }
        } catch (err) {
            AlertStore.Instance.showAlert(`Saving snippet ${name} failed!`);
            console.error(err);
            return false;
        }
    }

    @flow.bound *deleteSnippet(name: string, isSilent: boolean = false) {
        this.snippets.delete(name);
        try {
            const success = yield ApiService.Instance.clearSnippet(name);
            if (success) {
                // Silently exit on success if silent flag is set
                if (!isSilent) {
                    AppToaster.show(SuccessToast("console", `Snippet ${name} deleted successfully.`, SnippetStore.TOASTER_TIMEOUT));
                }
                return true;
            } else {
                AlertStore.Instance.showAlert(`Deleting snippet ${name} failed!`);
                return false;
            }
        } catch (err) {
            AlertStore.Instance.showAlert(`Deleting snippet ${name} failed!`);
            console.error(err);
            return false;
        }
    }

    @action private setSnippetExecuting = (isExecuting: boolean) => {
        this.isExecuting = isExecuting;
    };

    @flow.bound *executeCurrentSnippet() {
        // Empty parameters so snippets reading "parameters" don't throw when run from the editor
        const isSuccess = yield this.executeSnippet(this.activeSnippet, {});
        if (!isSuccess) {
            return false;
        }

        // Save current snippet as previous
        const snippet: Snippet = {
            snippetVersion: 1,
            frontendVersion: "v2.0.0",
            tags: ["previous"],
            categories: ["hidden"],
            requires: [],
            code: this.activeSnippet?.code
        };
        yield this.saveSnippet("_previous", snippet, true);
        return true;
    }

    // Execute any snippet with the given parameters (used by the URL auto-run)
    @flow.bound *executeSnippet(snippet: Snippet, parameters?: {[key: string]: any}) {
        const functionToExecute = this.compileSnippet(snippet?.code);
        if (!functionToExecute || this.isExecuting) {
            return false;
        }
        this.setSnippetExecuting(true);
        try {
            yield functionToExecute(parameters ?? {});
            this.setSnippetExecuting(false);
            return true;
        } catch (err) {
            this.setSnippetExecuting(false);
            console.warn(err);
            return false;
        }
    }

    // Look up a snippet by name and execute it with the given parameters
    @flow.bound *executeSnippetByName(name: string, parameters?: {[key: string]: any}) {
        const snippet = this.snippets.get(name);
        if (!snippet) {
            AlertStore.Instance.showAlert(`Code snippet "${name}" was not found.`);
            return false;
        }
        return yield this.executeSnippet(snippet, parameters);
    }
}
