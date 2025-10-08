import * as AST from "ast_wrapper";

import {SystemType} from "stores";

export class ASTSettingsString {
    stringList: Array<string>;

    constructor() {
        this.stringList = [];
    }

    add(name: string, value: any, storeIf: boolean = true) {
        if (value !== undefined && storeIf) {
            let storedValue = typeof value === "boolean" ? (value ? 1 : 0) : value;
            this.stringList.push(`${name}=${storedValue}`);
        }
    }

    addSection(section: string) {
        if (section !== undefined) {
            this.stringList.push(section);
        }
    }

    toString() {
        return this.stringList.filter(str => str.length > 0).join(", ");
    }
}

/**
 * Get the Equinox and Epoch values for a given coordinate system
 * @param system - The coordinate system type
 * @returns An object with equinox and epoch strings, or null if not applicable
 */
function getEquinoxEpochForSystem(system: SystemType): {equinox: string; epoch: string} | null {
    if (system === SystemType.FK4) {
        return {equinox: "B1950.0", epoch: "B1950.0"};
    } else if (system === SystemType.FK5 || system === SystemType.Ecliptic || system === SystemType.Galactic) {
        return {equinox: "J2000.0", epoch: "J2000.0"};
    }
    return null;
}

/**
 * Set the System on an AST settings string and add Equinox/Epoch for that system when applicable.
 * @param astString - The AST settings string to update
 * @param system - The coordinate system to set and to use for Equinox/Epoch values
 * @param skipSystem - Whether to only add Equinox/Epoch values, skip adding the System to the AST settings string
 */
export function setAstStringSystem(astString: ASTSettingsString, system: SystemType, skipSystem: boolean = false): void {
    if (!skipSystem) {
        astString.add("System", system);
    }
    const values = getEquinoxEpochForSystem(system);
    if (values) {
        astString.add("Equinox", values.equinox);
        astString.add("Epoch", values.epoch);
    }
}

/**
 * Set the System on an AST FrameSet and apply Equinox/Epoch for that system when applicable.
 * @param astTransform - The AST FrameSet to configure
 * @param system - The coordinate system to set and to use for Equinox/Epoch values
 * @param skipSystem - Whether to only apply Equinox/Epoch values, skip setting the System
 */
export function setAstSystem(astTransform: AST.FrameSet, system: SystemType, skipSystem: boolean = false): void {
    if (!skipSystem) {
        AST.set(astTransform, `System=${system}`);
    }
    const values = getEquinoxEpochForSystem(system);
    if (values) {
        AST.set(astTransform, `Equinox=${values.equinox}, Epoch=${values.epoch}`);
    }
}
