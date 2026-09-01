const SCRIPTING_MAP_MARKER = Symbol("cartaScriptingMap");

export type StructuredReturnPath = string[] | Record<string, string>;
export type ReturnPath = string | StructuredReturnPath;

export function markAsScriptingMap<T extends object>(value: T): T {
    Object.defineProperty(value, SCRIPTING_MAP_MARKER, {value: true});
    return value;
}

export function isScriptingMap(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && (value as Record<symbol, unknown>)[SCRIPTING_MAP_MARKER] === true;
}

export function parseReturnPath(value: string): ReturnPath {
    if (value.startsWith("[") || value.startsWith("{")) {
        let parsed: unknown;
        try {
            parsed = JSON.parse(value);
        } catch {
            // Treat invalid JSON as a legacy string path.
            return value;
        }

        if (Array.isArray(parsed)) {
            const invalidIndex = parsed.findIndex(path => typeof path !== "string");
            if (invalidIndex !== -1) {
                throw new Error(`Invalid return path at index ${invalidIndex}: expected a string, got ${JSON.stringify(parsed[invalidIndex])}`);
            }
            return parsed as string[];
        }

        if (parsed && typeof parsed === "object") {
            const invalidEntry = Object.entries(parsed).find(([, path]) => typeof path !== "string");
            if (invalidEntry) {
                throw new Error(`Invalid return path for key "${invalidEntry[0]}": expected a string, got ${JSON.stringify(invalidEntry[1])}`);
            }
            return parsed as Record<string, string>;
        }
    }

    return value;
}
