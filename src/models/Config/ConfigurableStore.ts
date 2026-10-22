/**
 * A config as it is read back from a saved file: every field may be missing or of the wrong type,
 * so the store that applies it checks each one before taking it.
 */
export type Persisted<TConfig> = Partial<Record<keyof TConfig, unknown>>;

/**
 * A store whose state can be saved as a config and applied again.
 *
 * `TInput` is what {@link ConfigurableStore.applyConfig} accepts: the config itself when it has
 * been validated before it arrives, or {@link Persisted} when the store validates it.
 */
export interface ConfigurableStore<TConfig, TInput = TConfig> {
    toConfig(): TConfig;
    applyConfig(config: TInput): void;
}

/**
 * A widget's store that carries the widget's own ID: the key its Widget Config is kept under, which
 * stays the same across sessions, unlike the ID the layout engine gives the widget each time an
 * arrangement is applied (ADR-0005).
 */
export interface IdentifiedWidgetStore {
    widgetId: string;
}
