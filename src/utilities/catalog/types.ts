import type {CatalogSystemType, SimbadMirror, VizierMirror} from "enums";

export type CatalogMirror = SimbadMirror | VizierMirror;

export type CatalogCoordinateSystem = {
    system: CatalogSystemType;
    equinox: string | null | undefined;
    epoch: string | null | undefined;
};
