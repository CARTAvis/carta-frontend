import {observer} from "mobx-react";
import * as React from "react";
import {action, makeObservable, observable} from "mobx";
import {AnchorButton, IOptionProps, Menu, MenuItem, Popover, Position} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";

type MultiSelectItem = string | CARTA.StatsType;

@observer
export class MultiSelectButtonComponent extends React.Component<{itemOptions: IOptionProps[], itemSelected: MultiSelectItem[], onItemSelect: (item: MultiSelectItem) => void, disabled: boolean}> {
    @observable isOpen: boolean = false;

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    @action onClick = (ev) => {
        this.isOpen = !this.isOpen;
    };

    public render() {
        const menu = (
            <Menu>
                {this.props.itemOptions?.map((item) =>
                    <MenuItem
                        key={item.value}
                        text={item.label}
                        onClick={(ev) => this.props.onItemSelect(item.value)}
                        icon={this.props.itemSelected?.includes(item.value) ? "tick" : "blank"}
                    />
                )}
            </Menu>
        );

        return (
            <React.Fragment>
                <Popover
                    content={menu}
                    isOpen={this.isOpen}
                    position={Position.BOTTOM}
                    disabled={this.props.disabled}
                    minimal={true}
                >
                    <AnchorButton active={this.isOpen} rightIcon={"caret-down"} disabled={this.props.disabled} onClick={this.onClick}/>
                </Popover>
            </React.Fragment>
        );
    }
}