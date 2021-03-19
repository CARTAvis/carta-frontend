import {observer} from "mobx-react";
import * as React from "react";
import {AnchorButton, IOptionProps, Menu, MenuItem, Popover, Position, Tooltip} from "@blueprintjs/core";
import {ProfileCategory} from "stores/widgets";
import {CARTA} from "carta-protobuf";

type MultiSelectItem = string | CARTA.StatsType;
export class ProfileSelectionComponentProps {
    category: ProfileCategory;
    selectedCategory: ProfileCategory;
    itemOptions: IOptionProps[];
    itemSelected: MultiSelectItem[];
    disabled: boolean;
    onCategorySelect: () => void;
    onItemSelect: (item: MultiSelectItem) => void;
}

@observer
export class ProfileSelectionComponent extends React.Component<ProfileSelectionComponentProps> {
    public render() {
        return (
            <React.Fragment>
                <Tooltip content="Select to show multiple profiles" position={Position.TOP}>
                    <AnchorButton
                        text={this.props.category}
                        active={this.props.selectedCategory === this.props.category}
                        onClick={(ev) => this.props.onCategorySelect()}
                        disabled={this.props.disabled}
                    />
                </Tooltip>
                <Popover
                    content={
                        <Menu>
                            {this.props.itemOptions?.map((item) =>
                                <MenuItem
                                    key={item.value}
                                    text={item.label}
                                    onClick={(ev) => this.props.onItemSelect(item.value)}
                                    icon={this.props.itemSelected?.includes(item.value) ? "tick" : "blank"}
                                    shouldDismissPopover={false}
                                />
                            )}
                        </Menu>
                    }
                    minimal={true}
                    placement={Position.BOTTOM}
                >
                    <AnchorButton rightIcon={"caret-down"} disabled={this.props.disabled}/>
                </Popover>
            </React.Fragment>
        );
    }
}
