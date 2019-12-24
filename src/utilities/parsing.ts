export function parseBoolean(value: string, defaultValue: boolean): boolean {
    if (value === "true") {
        return true;
    } else if (value === "false") {
        return false;
    } else {
        return defaultValue;
    }
}

export function parseNumber(val: number, initVal: number): number {
    if (isFinite(val)) {
        return val;
    } else {
        return initVal;
    }
}

export function trimFitsComment(val: string): string {
    if (!val) {
        return "";
    }

    // replace standard Fits header comments
    return val.replace(/\s\/\s?.*$/, "");
}