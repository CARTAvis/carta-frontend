import {CARTA} from "carta-protobuf";
import {action, computed, makeObservable,observable} from "mobx";

export class LogEntry {
    tags: string[];
    level: CARTA.ErrorSeverity;
    title: string;
    message: string;
}

export class LogStore {
    private static staticInstance: LogStore;

    static get Instance() {
        if (!LogStore.staticInstance) {
            LogStore.staticInstance = new LogStore();
        }
        return LogStore.staticInstance;
    }

    @observable logEntries: LogEntry[];
    @observable hiddenTags: string[];
    @observable logLevel: CARTA.ErrorSeverity;
    readonly logLimit = 1000;

    private constructor() {
        makeObservable(this);
        this.logEntries = [];
        this.hiddenTags = [];
        this.logLevel = CARTA.ErrorSeverity.INFO;
    }

    @computed get newestMsg(): string {
        return this.logEntries.length > 0 ? this.logEntries[this.logEntries.length - 1].message : "";
    }

    @action addLog(entry: LogEntry) {
        this.logEntries.push(entry);
        if (this.logEntries.length > this.logLimit) {
            this.logEntries.shift();
        }
    }

    @action addDebug(message: string, tags: string[] = [], title: string = "") {
        this.addLog({message, title, tags, level: CARTA.ErrorSeverity.DEBUG});
    }

    @action addInfo(message: string, tags: string[] = [], title: string = "") {
        this.addLog({message, title, tags, level: CARTA.ErrorSeverity.INFO});
    }

    @action addWarning(message: string, tags: string[] = [], title: string = "") {
        this.addLog({message, title, tags, level: CARTA.ErrorSeverity.WARNING});
    }

    @action addError(message: string, tags: string[] = [], title: string = "") {
        this.addLog({message, title, tags, level: CARTA.ErrorSeverity.ERROR});
    }

    @action toggleTag(tag: string) {
        if (this.hiddenTags.indexOf(tag) === -1) {
            this.hiddenTags.push(tag);
        } else {
            this.hiddenTags = this.hiddenTags.filter(t => t !== tag);
        }
    }

    @action setLevel(level: CARTA.ErrorSeverity) {
        this.logLevel = level;
    }

    @action clearLog() {
        this.logEntries = [];
    }
}
