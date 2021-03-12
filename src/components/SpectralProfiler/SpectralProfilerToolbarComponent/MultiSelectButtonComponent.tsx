import * as React from "react";
import {AbstractPureComponent2, AnchorButton, IOptionProps, Menu, MenuItem, Popover, Position} from "@blueprintjs/core";
import {ARROW_DOWN, ESCAPE} from "@blueprintjs/core/lib/cjs/common/keys";
import {CARTA} from "carta-protobuf";

type MultiSelectItem = string | CARTA.StatsType;

/*
    NOTE:
    This component is a modification of <MultiSelect> (a multi-selectable "input") from @blueprintjs/select in order to create a multi-selectable "button".
    And there are warnings when @observer of mobx-react applying to AbstractPureComponent2, since AbstractPureComponent2 is a React.PureComponent but @observer requires a React.Component.
    So we have to use primitive this.setState() instead of observer/observable of mobx.
*/
export class MultiSelectButtonComponent extends AbstractPureComponent2<{itemOptions: IOptionProps[], itemSelected: MultiSelectItem[], onItemSelect: (item: MultiSelectItem) => void, disabled: boolean}> {
    private button: HTMLAnchorElement | null = null;
    public state: {isOpen: boolean} = {
        isOpen: false
    };

    private onClick = (ev) => {
        this.setState({isOpen: !this.state.isOpen});
    };

    private handlePopoverInteraction = (nextOpenState: boolean) => {
        this.requestAnimationFrame(() => {
            if (this.button && this.button !== document.activeElement) {
                this.setState({isOpen: false});
            }
        });
    };

    private handleButtonKeyDown = (ev: React.KeyboardEvent<HTMLElement>) => {
        if (ev.keyCode === ESCAPE) {
            this.button?.blur();
            this.setState({isOpen: false});
        } else if (ev.keyCode === ARROW_DOWN) {
            this.setState({isOpen: true});
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
            <Popover
                autoFocus={false}
                enforceFocus={false}
                content={menu}
                isOpen={this.state.isOpen}
                placement={Position.BOTTOM}
                disabled={this.props.disabled}
                onInteraction={this.handlePopoverInteraction}
                minimal={true}
            >
                <AnchorButton
                    active={this.state.isOpen}
                    rightIcon={"caret-down"}
                    disabled={this.props.disabled}
                    onClick={this.onClick}
                    elementRef={(button) => this.button = button}
                    onKeyDown={this.handleButtonKeyDown}
                />
            </Popover>
        );
    }
}
