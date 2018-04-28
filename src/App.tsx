import * as React from "react";
import "./App.css";
import {PlaceholderComponent} from "./components/Placeholder/PlaceholderComponent";
import * as GoldenLayout from "golden-layout";
import {RootMenuComponent} from "./components/Menu/RootMenuComponent";

class App extends React.Component {

    constructor(props: any) {
        super(props);
    }
    public componentDidMount() {

        const layoutContents = [{
            type: "row",
            content: [{
                type: "column",
                content: [{
                    type: "react-component",
                    component: "placeholder-component",
                    title: "Image.fits",
                    height: 80,
                    isClosable: false,
                    props: {label: "Image placeholder"}
                }, {
                    type: "stack",
                    content: [{
                        type: "react-component",
                        component: "placeholder-component",
                        title: "Animation",
                        props: {label: "Animation placeholder"}
                    }, {
                        type: "react-component",
                        component: "placeholder-component",
                        title: "Color map",
                        props: {label: "Color map placeholder"}
                    }]
                }]
            }, {
                type: "column",
                content: [{
                    type: "react-component",
                    component: "placeholder-component",
                    title: "X Profile: Cursor",
                    props: {label: "Graph placeholder"}
                }, {
                    type: "react-component",
                    component: "placeholder-component",
                    title: "Y Profile: Cursor",
                    props: {label: "Graph placeholder"}
                }, {
                    type: "react-component",
                    component: "placeholder-component",
                    title: "Z Profile: Cursor",
                    props: {label: "Graph placeholder"}
                }, {
                    type: "stack",
                    height: 33.3,
                    content: [{
                        type: "react-component",
                        component: "placeholder-component",
                        title: "Histogram: Region #1",
                        props: {label: "Histogram placeholder"}
                    }, {
                        type: "react-component",
                        component: "placeholder-component",
                        title: "Statistics: Region #1",
                        props: {label: "Statistics placeholder"}
                    }]
                }]
            }]
        }];
        const myLayout = new GoldenLayout({
            settings: {
                showPopoutIcon: false
            },
            content: layoutContents
        });
        myLayout.registerComponent("placeholder-component", PlaceholderComponent);
        myLayout.init();
    }

    public render() {

        return (
            <div className="App">
                <RootMenuComponent/>
            </div>
        );
    }
}

export default App;
