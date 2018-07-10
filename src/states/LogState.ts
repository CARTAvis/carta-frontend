import {action, observable} from "mobx";
import {CARTA} from "carta-protobuf";

export class LogEntry {
    tags: string[];
    level: CARTA.ErrorSeverity;
    title: string;
    message: string;
}

export class LogState {
    @observable logEntries: LogEntry[];
    @observable hiddenTags: string[];
    @observable logLevel: CARTA.ErrorSeverity;

    constructor() {
        this.logEntries = [];
        this.hiddenTags = [];
        this.logLevel = CARTA.ErrorSeverity.INFO;
    }

    @action addLog(entry: LogEntry) {
        this.logEntries.push(entry);
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
        }
        else {
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