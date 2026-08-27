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
        try {
            const parsed: unknown = JSON.parse(value);
            if (Array.isArray(parsed) && parsed.every(path => typeof path === "string")) {
                return parsed;
            }
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && Object.values(parsed).every(path => typeof path === "string")) {
                return parsed as Record<string, string>;
            }
        } catch {
            // Treat invalid JSON as a legacy string path.
        }
    }

    return value;
}
