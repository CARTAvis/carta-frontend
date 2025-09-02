import {Position} from "@blueprintjs/core";
import {action, makeObservable, observable} from "mobx";

import {HelpType} from "enums";

export class HelpStore {
    private static staticInstance: HelpStore;

    constructor() {
        makeObservable(this);
    }

    static get Instance() {
        if (!HelpStore.staticInstance) {
            HelpStore.staticInstance = new HelpStore();
        }
        return HelpStore.staticInstance;
    }

    @observable type: HelpType = undefined as any;
    @observable helpVisible: boolean = false;
    @observable position: Position = Position.RIGHT;

    @action showHelpDrawer = (helpType: HelpType, centerX: number) => {
        this.type = helpType;
        this.position = centerX > document.body.clientWidth * 0.5 ? Position.LEFT : Position.RIGHT;
        this.helpVisible = true;
    };

    @action hideHelpDrawer = () => {
        this.helpVisible = false;
    };
}
