/**
 * A config as it is read back from a saved file. Any field of it can be missing or have the wrong
 * type. So the store that applies the config checks each field before it uses the value.
 */
export type Persisted<TConfig> = Partial<Record<keyof TConfig, unknown>>;

/**
 * A store whose state can be saved as a config and applied again.
 *
 * `TInput` is the type that {@link ConfigurableStore.applyConfig} accepts. It is the config itself
 * when the config is validated before it reaches the store. It is {@link Persisted} when the store
 * validates the config.
 */
export interface ConfigurableStore<TConfig, TInput = TConfig> {
    toConfig(): TConfig;
    applyConfig(config: TInput): void;
}

/**
 * A widget store that carries the widget's own ID. The Widget Config of the widget is saved under
 * this ID. This ID stays the same across sessions. The ID that the layout engine gives the widget
 * changes each time an arrangement is applied.
 */
export interface IdentifiedWidgetStore {
    widgetId: string;
}

/**
 * The kind of layout that is saved or applied.
 *
 * - `regular`: a saved layout, a preset layout, the layout in the preferences, or a dynamic layout.
 * - `workspace`: the copy of the layout that a workspace keeps. It also keeps what only a workspace
 *   needs, such as the own ID of each widget and the settings of the image view grid.
 */
export type LayoutPersistence = "regular" | "workspace";

/**
 * A widget store that keeps more settings in the layout copy of a workspace than in a regular
 * layout. `toWorkspaceLayoutConfig` returns the settings of a regular layout and the extra
 * settings. `applyWorkspaceLayoutConfig` applies them.
 */
export interface WorkspaceLayoutConfigurable<TConfig> {
    toWorkspaceLayoutConfig(): TConfig;
    applyWorkspaceLayoutConfig(config: Persisted<TConfig>): void;
}
