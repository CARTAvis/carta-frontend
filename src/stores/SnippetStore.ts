import {observable, computed, action, makeObservable, runInAction} from "mobx";
import {AlertStore} from "stores";
import {AppToaster, SuccessToast} from "components/Shared";
import {ApiService} from "services";
import {Snippet} from "models/Snippet";

export class SnippetStore {
    private static staticInstance: SnippetStore;

    static get Instance() {
        if (!SnippetStore.staticInstance) {
            SnippetStore.staticInstance = new SnippetStore();
        }
        return SnippetStore.staticInstance;
    }

    public static readonly ToasterTimeout = 1500;

    @observable snippets: Map<string, Snippet>;
    @observable activeSnippetString: string;
    @observable isExecuting: boolean;

    private constructor() {
        makeObservable(this);
        this.snippets = new Map<string, Snippet>();
        this.activeSnippetString = "";
        this.isExecuting = false;
    }

    public snippetExists = (name: string): boolean => {
        return name && this.snippets.has(name);
    };

    @action fetchSnippets = async () => {
        this.snippets.clear();

        try {
            const userSnippets = await ApiService.Instance.getSnippets();
            runInAction(() => {
                for (const [name, snippet] of userSnippets) {
                    this.snippets.set(name, snippet);
                }
                const previousSnippet = this.snippets.get("_previous");
                if (previousSnippet) {
                    this.activeSnippetString = previousSnippet.code;
                }
            });
        } catch (err) {
            AlertStore.Instance.showAlert("Loading user-defined snippets failed!");
            console.log(err);
        }
    };

    @computed get numSavedSnippets(): number {
        return this.snippets.size;
    }

    @computed get validInput() {
        return this.functionToExecute !== undefined;
    }

    @computed
    private get functionToExecute() {
        const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
        if (AsyncFunction) {
            let f;
            try {
                f = new AsyncFunction(this.activeSnippetString);
            } catch (e) {
                f = undefined;
            }
            return f;
        }
    }

    @action setSnippetString = (val: string) => {
        this.activeSnippetString = val;
    };

    @action saveSnippet = async (name: string, snippet: Snippet, silent: boolean = false) => {
        this.snippets.set(name, snippet);

        try {
            const success = await ApiService.Instance.setSnippet(name, snippet);

            // Silently exit on success if silent flag is set
            if (silent && success) {
                return;
            }

            if (success) {
                AppToaster.show(SuccessToast("console", `Snippet ${name} saved successfully.`, SnippetStore.ToasterTimeout));
            } else {
                AlertStore.Instance.showAlert(`Saving snippet ${name} failed!`);
            }
        } catch (err) {
            AlertStore.Instance.showAlert(`Saving snippet ${name} failed!`);
        }
    };

    @action private setSnippetExecuting = (val: boolean) => {
        this.isExecuting = val;
    };

    async executeCurrentSnippet() {
        if (this.functionToExecute && !this.isExecuting) {
            this.setSnippetExecuting(true);
            try {
                await this.functionToExecute();
                this.setSnippetExecuting(false);

                // Save current snippet as previous
                const snippet: Snippet = {
                    snippetVersion: 1,
                    frontendVersion: "v2.0.0",
                    tags: ["previous"],
                    categories: ["hidden"],
                    requires: [],
                    code: this.activeSnippetString
                };
                await this.saveSnippet("_previous", snippet, true);
                return true;
            } catch (e) {
                this.setSnippetExecuting(false);
                console.log(e);
                return false;
            }
        } else {
            return false;
        }
    }
}
