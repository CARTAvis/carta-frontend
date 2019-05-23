import * as React from "react";
import {observer} from "mobx-react";
import {Select, ItemRenderer} from "@blueprintjs/select";
import {Button, IDialogProps, Intent, Tab, Tabs, IconName, MenuItem, FormGroup} from "@blueprintjs/core";
import {DraggableDialogComponent} from "components/Dialogs";
import {AppStore} from "stores";
import "./PreferenceDialogComponent.css";

export class Theme {
    name: string;
    icon: IconName;

    constructor(name: string, icon: IconName) {
        this.name = name;
        this.icon = icon;
    }
}

const ThemeSelect = Select.ofType<Theme>();

export const renderTheme: ItemRenderer<Theme> = (theme, {handleClick, modifiers, query}) => {
    return (
        <MenuItem
            active={modifiers.active}
            key={theme.name}
            icon={theme.icon}
            onClick={handleClick}
            text={theme.name}
        />
    );
};

@observer
export class PreferenceDialogComponent extends React.Component<{ appStore: AppStore }> {
    private getThemes = () => {
        const preferenceStore = this.props.appStore.preferencesStore;
        const themes: Theme [] = [{name: "Light", icon: "flash"}, {name: "Dark", icon: "moon"}];
        const currentTheme: Theme = preferenceStore.getTheme() === "Light" ? themes[0] : themes[1];

        return (
            <ThemeSelect
                activeItem={currentTheme}
                items={themes}
                itemRenderer={renderTheme}
                onItemSelect={(theme) => { preferenceStore.setTheme(theme.name); }}
                filterable={false}
            >
                <Button text={currentTheme.name} icon={currentTheme.icon} rightIcon="double-caret-vertical"/>
            </ThemeSelect>
        );
    };

    public render() {
        const appStore = this.props.appStore;
        const preferenceStore = appStore.preferencesStore;

        const globalPanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="Theme">{this.getThemes()}</FormGroup>
            </div>
        );

        const renderConfigPanel = (
            <div className="panel-container">
            </div>
        );

        let className = "preference-dialog";
        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

        const dialogProps: IDialogProps = {
            icon: "settings",
            backdropClassName: "minimal-dialog-backdrop",
            className: className,
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.preferenceDialogVisible,
            onClose: appStore.hidePreferenceDialog,
            title: "Preference",
        };

        return (
            <DraggableDialogComponent dialogProps={dialogProps} minWidth={300} minHeight={300} defaultWidth={600} defaultHeight={450} enableResizing={true}>
                <div className="bp3-dialog-body">
                    <Tabs
                        id="preferenceTabs"
                        vertical={true}
                        selectedTabId={preferenceStore.perferenceActiveTab}
                        onChange={(tabId) => preferenceStore.setPreferenceActiveTab(String(tabId))}
                    >
                        <Tab id="global" title="Global" panel={globalPanel}/>
                        <Tab id="renderConfig" title="Render Config" panel={renderConfigPanel}/>
                    </Tabs>
                </div>
                <div className="bp3-dialog-footer">
                    <div className="bp3-dialog-footer-actions">
                        <Button intent={Intent.PRIMARY} onClick={appStore.hidePreferenceDialog} text="Close"/>
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}
