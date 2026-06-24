import type {RJSFSchema, UiSchema} from "@rjsf/utils";
import {action, makeObservable, observable, ObservableMap} from "mobx";

export interface CustomUIDefinitionInput {
    title?: string;
    width?: number;
    height?: number;
    // Declarative (RJSF) — present when schema is set
    schema?: RJSFSchema;
    uiSchema?: UiSchema;
    formData?: any;
    onChange?: (formData: any) => void;
    onSubmit?: (formData: any) => void;
    // Imperative escape hatch — present when render is set
    render?: (container: HTMLElement) => void | (() => void);
}

export interface CustomUIDefinition extends CustomUIDefinitionInput {
    id: string;
    surface: "widget" | "dialog";
}

export interface CustomUIHostHandlers {
    floatWidget: (id: string, def: CustomUIDefinition) => void;
    closeWidget: (id: string) => void;
    openDialog: (id: string) => void;
    closeDialog: (id: string) => void;
}

/** Returned by {@link CustomUIStore.open}; lets a snippet drive and observe one open surface. */
export interface CustomUIHandle {
    id: string;
    surface: "widget" | "dialog";
    /** Programmatically close this widget/dialog. */
    close: () => void;
    /**
     * Register a callback invoked when this widget/dialog is closed — by the user (the dialog's
     * close button / closing the floating widget), via `close()`, or by `unregister` while open.
     * Fires at most once per `open()` call; reopen to observe the next close. Replaces any
     * previously registered callback for this id.
     */
    onClose: (callback: () => void) => void;
}

export class CustomUIStore {
    private static staticInstance: CustomUIStore;

    public static get Instance() {
        if (!CustomUIStore.staticInstance) {
            CustomUIStore.staticInstance = new CustomUIStore();
        }
        return CustomUIStore.staticInstance;
    }

    @observable definitions = new ObservableMap<string, CustomUIDefinition>();

    private readonly cleanups = new Map<string, () => void>();
    private readonly closeCallbacks = new Map<string, () => void>();
    /** Ids currently shown (floated/open). Used to keep `open` idempotent and `onClose` once-per-open. */
    private readonly openIds = new Set<string>();
    private handlers: CustomUIHostHandlers | null = null;

    private constructor() {
        makeObservable(this);
    }

    setHostHandlers = (handlers: CustomUIHostHandlers) => {
        this.handlers = handlers;
    };

    /** Registered by the imperative host so unregister/replace can tear the DOM content down. */
    setCleanup = (id: string, cleanup: () => void) => {
        this.cleanups.set(id, cleanup);
    };

    registerWidget = (id: string, def: CustomUIDefinitionInput) => this.register(id, "widget", def);
    registerDialog = (id: string, def: CustomUIDefinitionInput) => this.register(id, "dialog", def);

    @action private register(id: string, surface: "widget" | "dialog", input: CustomUIDefinitionInput) {
        const existing = this.definitions.get(id);
        // Name collision: re-registering an existing id replaces it in place (idempotent). But if the
        // SURFACE changes (widget<->dialog) while the old one is open, close the old surface first so
        // it isn't orphaned (this fires its onClose).
        if (existing && existing.surface !== surface) {
            this.closeOpenSurface(id, existing.surface);
        }
        this.runCleanup(id);
        let def: CustomUIDefinition = {...input, id, surface};
        if (def.schema && def.render) {
            console.warn(`[customUI] "${id}" supplied both schema and render; using schema.`);
            def = {...def, render: undefined};
        }
        this.definitions.set(id, def);
    }

    open = (id: string): CustomUIHandle | undefined => {
        const def = this.definitions.get(id);
        if (!def) {
            return undefined;
        }
        // Idempotent: opening an already-open surface returns a fresh handle without floating/opening
        // a duplicate.
        if (!this.openIds.has(id)) {
            this.openIds.add(id);
            if (def.surface === "widget") {
                this.handlers?.floatWidget(id, def);
            } else {
                this.handlers?.openDialog(id);
            }
        }
        return this.makeHandle(id, def.surface);
    };

    private makeHandle(id: string, surface: "widget" | "dialog"): CustomUIHandle {
        return {
            id,
            surface,
            close: () => this.close(id),
            onClose: (callback: () => void) => {
                this.closeCallbacks.set(id, callback);
            }
        };
    }

    /**
     * Invoked by the host wiring layer (the AppStore close-detection reaction) when a surface is
     * closed by the USER. Fires the registered onClose callback once, then forgets it. No-op if the
     * id is not currently open (so it cannot double-fire). Not part of the snippet-facing facade.
     */
    notifyClosed = (id: string) => {
        if (!this.openIds.has(id)) {
            return;
        }
        this.openIds.delete(id);
        const callback = this.closeCallbacks.get(id);
        if (callback) {
            this.closeCallbacks.delete(id);
            try {
                callback();
            } catch (err) {
                console.error(`[customUI] onClose callback for "${id}" threw`, err);
            }
        }
    };

    close = (id: string) => {
        const def = this.definitions.get(id);
        if (!def) {
            return;
        }
        this.closeOpenSurface(id, def.surface);
    };

    /**
     * Fire the surface's onClose (once, only if it was open) then ask the host to remove it. The host
     * closer is a no-op when the surface isn't shown, so this is safe to call unconditionally.
     */
    private closeOpenSurface(id: string, surface: "widget" | "dialog") {
        this.notifyClosed(id);
        if (surface === "widget") {
            this.handlers?.closeWidget(id);
        } else {
            this.handlers?.closeDialog(id);
        }
    }

    @action update = (id: string, formData: any) => {
        const def = this.definitions.get(id);
        if (def) {
            this.definitions.set(id, {...def, formData});
        }
    };

    getData = (id: string): any => this.definitions.get(id)?.formData;

    @action unregister = (id: string) => {
        const def = this.definitions.get(id);
        this.runCleanup(id);
        // Close the surface if it is still open (this fires its onClose callback), then forget it.
        if (def) {
            this.closeOpenSurface(id, def.surface);
        }
        this.closeCallbacks.delete(id);
        this.openIds.delete(id);
        this.definitions.delete(id);
    };

    @action clear = () => {
        for (const id of Array.from(this.definitions.keys())) {
            this.runCleanup(id);
        }
        this.closeCallbacks.clear();
        this.openIds.clear();
        this.definitions.clear();
    };

    private runCleanup(id: string) {
        const cleanup = this.cleanups.get(id);
        if (cleanup) {
            try {
                cleanup();
            } catch (err) {
                console.error(`[customUI] cleanup for "${id}" threw`, err);
            }
            this.cleanups.delete(id);
        }
    }
}
