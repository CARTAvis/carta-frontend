import {CatalogDatabase, SimbadMirror, VizierMirror} from "enums";

import type {CatalogMirror} from "./types";

const SIMBAD_MIRROR_URLS: Record<SimbadMirror, string> = {
    [SimbadMirror.STRASBOURG]: "https://simbad.u-strasbg.fr/simbad/sim-tap/",
    [SimbadMirror.CFA_HARVARD]: "https://simbad.cfa.harvard.edu/simbad/sim-tap/"
};

const VIZIER_MIRROR_URLS: Record<VizierMirror, string> = {
    [VizierMirror.CDS]: "https://vizier.cds.unistra.fr/viz-bin/",
    [VizierMirror.ADAC]: "http://vizier.nao.ac.jp/viz-bin/",
    [VizierMirror.IUCAA]: "https://vizier.iucaa.in/viz-bin/",
    [VizierMirror.INASAN]: "https://vizier.inasan.ru/viz-bin/",
    [VizierMirror.NAOC]: "http://vizier.china-vo.org/viz-bin/",
    [VizierMirror.CFA_HARVARD]: "https://vizier.cfa.harvard.edu/viz-bin/",
    [VizierMirror.IDIA]: "https://vizier.idia.ac.za/viz-bin/"
};

export const CATALOG_MIRROR_URLS: Readonly<Record<CatalogMirror, string>> = {
    ...SIMBAD_MIRROR_URLS,
    ...VIZIER_MIRROR_URLS
};

export const CATALOG_MIRRORS_BY_DATABASE: {
    [CatalogDatabase.SIMBAD]: readonly SimbadMirror[];
    [CatalogDatabase.VIZIER]: readonly VizierMirror[];
} = {
    [CatalogDatabase.SIMBAD]: [SimbadMirror.STRASBOURG, SimbadMirror.CFA_HARVARD],
    [CatalogDatabase.VIZIER]: [VizierMirror.CDS, VizierMirror.ADAC, VizierMirror.IUCAA, VizierMirror.INASAN, VizierMirror.NAOC, VizierMirror.CFA_HARVARD, VizierMirror.IDIA]
};
