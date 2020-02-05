import {action, observable} from "mobx";

export class HelpStore {
    @observable helpVisible: boolean = false;
    @observable helpTitle: string = "demo title";
    @observable helpContext: string;

    @action showHelpDrawer = (helpContext: string) => {
        this.helpContext = helpContext;
        this.helpVisible = true;
    };

    @action hideHelpDrawer = () => {
        this.helpVisible = false;
    };

}