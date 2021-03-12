import {observer} from "mobx-react";
import * as React from "react";
import {action, makeObservable, observable} from "mobx";
import {AnchorButton, IOptionProps, Menu, MenuItem, Popover, Position} from "@blueprintjs/core";
import {ARROW_DOWN, ESCAPE} from "@blueprintjs/core/lib/cjs/common/keys";
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
        if (this.button && this.button !== document.activeElement) {
            this.isOpen = false;
        }
    };

    @action private handleButtonKeyDown = (ev: React.KeyboardEvent<HTMLElement>) => {
        if (ev.keyCode === ESCAPE) {
            this.button?.blur();
            this.isOpen = false;
        } else if (ev.keyCode === ARROW_DOWN) {
            this.isOpen = true;
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
                        onKeyDown={this.handleButtonKeyDown}
                    />
                </Popover>
            </React.Fragment>
        );
    }
}