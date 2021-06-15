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

    private constructor() {
        makeObservable(this);
        this.snippets = new Map<string, Snippet>();
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
            });
        } catch (err) {
            AlertStore.Instance.showAlert("Loading user-defined snippets failed!");
            console.log(err);
        }
    };

    @computed get numSavedSnippets(): number {
        return this.snippets.size;
    }

    @action saveSnippet = async (name: string, snippet: Snippet) => {
        this.snippets.set(name, snippet);

        try {
            const success = await ApiService.Instance.setSnippet(name, snippet);
            if (success) {
                AppToaster.show(SuccessToast("console", `Snippet ${name} saved successfully.`, SnippetStore.ToasterTimeout));
            } else {
                AlertStore.Instance.showAlert(`Saving snippet ${name} failed!`);
            }
        } catch (err) {
            AlertStore.Instance.showAlert(`Saving snippet ${name} failed!`);
        }
    };
}
