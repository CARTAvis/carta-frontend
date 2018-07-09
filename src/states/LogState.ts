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

    @action clearLog() {
        this.logEntries = [];
    }

    constructor() {
        this.logEntries = [];
    }
}