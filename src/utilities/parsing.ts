export function parseBoolean(value: string, defaultValue: boolean): boolean {
    if (value === "true") {
        return true;
    } else if (value === "false") {
        return false;
    } else {
        return defaultValue;
    }
}

export function parseUndefinedValue(val: number, initVal: number): number {
    if (typeof val !== "undefined") {
        return val;
    } else {
        return initVal;
    }
}