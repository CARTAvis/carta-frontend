import {observable, action} from "mobx";

export class LayoutStore {

    @action saveLayout = (name: string) => {
        console.log(name);
    };
}