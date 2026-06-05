import {Position} from "@blueprintjs/core";
import {action, makeObservable, observable} from "mobx";

import {type HelpType} from "enums";

export class HelpStore {
    private static staticInstance: HelpStore;

    constructor() {
        makeObservable(this);
    }

    public static get Instance() {
        if (!HelpStore.staticInstance) {
            HelpStore.staticInstance = new HelpStore();
        }
        return HelpStore.staticInstance;
    }

    @observable type: HelpType = undefined as any;
    @observable isHelpVisible: boolean = false;
    @observable position: Position = Position.RIGHT;

    @action showHelpDrawer = (helpType: HelpType, centerX: number, containerWidth?: number) => {
        this.type = helpType;
        const width = containerWidth ?? document.body.clientWidth;
        this.position = centerX > width * 0.5 ? Position.LEFT : Position.RIGHT;
        this.isHelpVisible = true;
    };

    @action hideHelpDrawer = () => {
        this.isHelpVisible = false;
    };
}
