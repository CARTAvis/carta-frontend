import {observer} from "mobx-react";
import * as React from "react";
import {action, makeObservable, observable} from "mobx";
import {AnchorButton, IOptionProps, Menu, MenuItem, Popover, Position} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";

type MultiSelectItem = string | CARTA.StatsType;

@observer
export class MultiSelectButtonComponent extends React.Component<{itemOptions: IOptionProps[], itemSelected: MultiSelectItem[], onItemSelect: (item: MultiSelectItem) => void, disabled: boolean}> {
    private button: HTMLAnchorElement | null = null;
    @observable private isOpen: boolean = false;

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    @action private onClick = (ev) => {
        this.isOpen = !this.isOpen;
    };

    @action private handlePopoverInteraction = () => {
        const isButtonFocused = this.button === document.activeElement;
        if (this.button && !isButtonFocused) {
            this.isOpen = false;
        }
    };

    public render() {
        const menu = (
            <Menu>
                {this.props.itemOptions?.map((item) =>
                    <MenuItem
                        key={item.value}
                        text={item.label}
                        onClick={(ev) => {
                            this.button?.focus();
                            this.props.onItemSelect(item.value);
                        }}
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
                    onInteraction={this.handlePopoverInteraction}
                    minimal={true}
                >
                    <AnchorButton
                        active={this.isOpen}
                        rightIcon={"caret-down"}
                        disabled={this.props.disabled}
                        onClick={this.onClick}
                        elementRef={(button) => this.button = button}
                    />
                </Popover>
            </React.Fragment>
        );
    }
}