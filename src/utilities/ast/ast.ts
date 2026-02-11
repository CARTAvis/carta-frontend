import * as AST from "ast_wrapper";

import {CatalogSystemType} from "models";
import {SystemType} from "stores";
import {OverlayGlobalSettings} from "stores/OverlayStore/OverlayStore";

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
 * Get the Equinox and Epoch values for a given coordinate system.
 *
 * - Returns `{equinox: "B1950.0", epoch: "B1950.0"}` for `FK4`.
 * - Returns `{equinox: "J2000.0", epoch: "J2000.0"}` for non-image/pixel systems other than `FK4`.
 * - Returns `null` for image/pixel systems (`Image`, `Pixel0`, `Pixel1`).
 *
 * @param system - The coordinate system type
 * @returns An object with equinox and epoch strings, or `null` when not applicable
 */
function getEquinoxEpochForSystem(system: SystemType | CatalogSystemType): {equinox: string; epoch: string} | null {
    if (system === SystemType.FK4) {
        return {equinox: "B1950.0", epoch: "B1950.0"};
    } else if (system !== SystemType.Image && system !== CatalogSystemType.Pixel0 && system !== CatalogSystemType.Pixel1) {
        return {equinox: "J2000.0", epoch: "J2000.0"};
    }
    return null;
}

/**
 * Set the `System` on an AST settings string and add `Equinox`/`Epoch` for that system when applicable.
 *
 * Behavior:
 * - For image/pixel systems (`Image`, `Pixel0`, `Pixel1`): only `System` is added, and no `Equinox`/`Epoch` are appended.
 * - For other systems: `System` is added, and `Equinox`/`Epoch` are determined by the system and defaults.
 * - If `system` equals the `defaultSystem` in `overlayGlobalSettings`:
 *   - `FK4`: use `defaultEquinox` and `defaultEpoch` from `overlayGlobalSettings`.
 *   - `FK5`/`Ecliptic`: use `defaultEquinox` and the epoch from the standard values for the system.
 *   - Others: use the standard values returned by `getEquinoxEpochForSystem`.
 * - If `system` differs from `defaultSystem`: always use the standard values returned by `getEquinoxEpochForSystem`.
 *
 * @param astString - The AST settings string to update
 * @param system - The coordinate system to set and to use for Equinox/Epoch values
 * @param overlayGlobalSettings - The overlay global settings containing defaults
 */
export function setAstStringSystem(astString: ASTSettingsString, system: SystemType | CatalogSystemType | undefined, overlayGlobalSettings: OverlayGlobalSettings): void {
    if (system === undefined) {
        return;
    }

    const global = overlayGlobalSettings;
    const defaultSystem = global.defaultSystem;

    astString.add("System", system);

    // For Image (pixel) coordinates, do not add Equinox or Epoch
    if (system === SystemType.Image || system === CatalogSystemType.Pixel0 || system === CatalogSystemType.Pixel1) {
        return;
    }

    const values = getEquinoxEpochForSystem(system);

    if (system === defaultSystem) {
        if (system === SystemType.FK4) {
            astString.add("Equinox", global.defaultEquinox);
            astString.add("Epoch", global.defaultEpoch);
        } else if (system === SystemType.FK5 || system === SystemType.Ecliptic) {
            astString.add("Equinox", global.defaultEquinox);
            astString.add("Epoch", values?.epoch);
        } else {
            astString.add("Equinox", values?.equinox);
            astString.add("Epoch", values?.epoch);
        }
    } else {
        astString.add("Equinox", values?.equinox);
        astString.add("Epoch", values?.epoch);
    }
}

/**
 * Set the `System` on an AST `FrameSet` and apply `Equinox`/`Epoch` for that system when applicable.
 *
 * Builds an internal settings string via `setAstStringSystem` and calls `AST.set` on
 * the provided `FrameSet` only if the settings string is non-empty.
 *
 * @param astTransform - The AST `FrameSet` to configure
 * @param system - The coordinate system to set and to use for Equinox/Epoch values
 * @param overlayGlobalSettings - The overlay global settings containing defaults
 */
export function setAstSystem(astTransform: AST.FrameSet, system: SystemType | CatalogSystemType, overlayGlobalSettings: OverlayGlobalSettings): void {
    const astString = new ASTSettingsString();
    setAstStringSystem(astString, system, overlayGlobalSettings);
    if (astString.toString().length > 0) {
        AST.set(astTransform, astString.toString());
    }
}
