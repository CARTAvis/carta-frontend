import * as React from "react";
import { AppStore } from "stores";

export class ImageComponent extends React.Component<{ 
    appStore: AppStore,
    light: string,
    dark: string,
    width: string
 }> {
    public render() {
        return (
            <img src={this.props.appStore.darkTheme ? this.props.dark : this.props.light} style={{width: this.props.width, height: "auto"}}/>
        );
    }
}
