import * as _ from "lodash";
import {spy} from "mobx";

import {LogStore} from "stores/LogStore/LogStore";

export type HookHandler = (payload: any) => void | Promise<void>;

interface RateOptions {
    wait: number;
    leading?: boolean;
    trailing?: boolean;
}

export interface HookOptions {
    // debounce and throttle are mutually exclusive; if both are supplied, debounce wins (with a console.warn).
    debounce?: number | RateOptions;
    throttle?: number | RateOptions;
}

type Invoker = ((payload: any) => void) & {cancel?(): void};

interface Registration {
    id: string;
    event: string;
    handler: HookHandler;
    invoke: Invoker;
    options?: HookOptions;
}

const HOOK_LOG_TAG = "hooks";

function normalizeRate(opt: number | RateOptions): {wait: number; lodashOptions?: {leading?: boolean; trailing?: boolean}} {
    if (typeof opt === "number") {
        return {wait: opt};
    }
    const lodashOptions: {leading?: boolean; trailing?: boolean} = {};
    if (opt.leading !== undefined) {
        lodashOptions.leading = opt.leading;
    }
    if (opt.trailing !== undefined) {
        lodashOptions.trailing = opt.trailing;
    }
    return {wait: opt.wait, lodashOptions: Object.keys(lodashOptions).length ? lodashOptions : undefined};
}

export class HookStore {
    private static staticInstance: HookStore;

    public static get Instance() {
        if (!HookStore.staticInstance) {
            HookStore.staticInstance = new HookStore();
        }
        return HookStore.staticInstance;
    }

    private readonly registrations = new Map<string, Registration>();
    private spyDisposer: (() => void) | null = null;

    private constructor() {}

    set = (id: string, event: string, handler: HookHandler, options?: HookOptions): void => {
        // Idempotent: replacing an existing id cancels its pending timer first.
        this.delete(id);
        const invoke = this.buildInvoker(id, event, handler, options);
        this.registrations.set(id, {id, event, handler, invoke, options});
        if (event.startsWith("action:")) {
            this.ensureSpy();
        }
    };

    delete = (id: string): void => {
        const reg = this.registrations.get(id);
        if (reg) {
            reg.invoke.cancel?.();
            this.registrations.delete(id);
            this.maybeDisposeSpy();
        }
    };

    clear = (): void => {
        for (const reg of this.registrations.values()) {
            reg.invoke.cancel?.();
        }
        this.registrations.clear();
        this.maybeDisposeSpy();
    };

    list = (): {id: string; event: string; options?: HookOptions}[] => {
        return Array.from(this.registrations.values()).map(({id, event, options}) => ({id, event, options}));
    };

    has = (id: string): boolean => this.registrations.has(id);

    trigger = (event: string, payload?: any): void => {
        for (const reg of this.registrations.values()) {
            if (reg.event === event) {
                reg.invoke(payload);
            }
        }
    };

    private buildInvoker(id: string, event: string, handler: HookHandler, options?: HookOptions): Invoker {
        // The guarded function carries error isolation. Debounce/throttle wrap the guarded
        // function so deferred (trailing) invocations are guarded too.
        const guarded = (payload: any) => {
            try {
                const result = handler(payload);
                if (result && typeof (result as Promise<void>).then === "function") {
                    (result as Promise<void>).catch(err => this.logError(id, event, err));
                }
            } catch (err) {
                this.logError(id, event, err);
            }
        };

        if (options?.debounce != null && options?.throttle != null) {
            console.warn(`[hooks] Hook "${id}" supplied both debounce and throttle; using debounce.`);
        }

        if (options?.debounce != null) {
            const {wait, lodashOptions} = normalizeRate(options.debounce);
            return _.debounce(guarded, wait, lodashOptions);
        }
        if (options?.throttle != null) {
            const {wait, lodashOptions} = normalizeRate(options.throttle);
            return _.throttle(guarded, wait, lodashOptions);
        }
        return guarded;
    }

    private ensureSpy() {
        if (this.spyDisposer) {
            return;
        }
        this.spyDisposer = spy(event => {
            if ((event as {type: string}).type === "action") {
                const actionEvent = event as {name: string; arguments: any[]};
                this.trigger(`action:${actionEvent.name}`, {name: actionEvent.name, arguments: actionEvent.arguments});
            }
        });
    }

    private maybeDisposeSpy() {
        if (this.spyDisposer && !this.hasGenericHooks()) {
            this.spyDisposer();
            this.spyDisposer = null;
        }
    }

    private hasGenericHooks(): boolean {
        for (const reg of this.registrations.values()) {
            if (reg.event.startsWith("action:")) {
                return true;
            }
        }
        return false;
    }

    private logError(id: string, event: string, err: unknown) {
        const message = `Hook "${id}" (${event}) threw: ${err instanceof Error ? err.message : String(err)}`;
        console.error(message, err);
        LogStore.Instance.addError(message, [HOOK_LOG_TAG]);
    }
}
