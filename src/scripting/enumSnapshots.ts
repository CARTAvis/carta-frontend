import {CARTA} from "carta-protobuf";

import * as FrontendEnums from "../enums";

export type EnumSnapshotValue = string | number;

export interface EnumSnapshotEntry {
    name: string;
    value: EnumSnapshotValue;
}

export type EnumSnapshot = EnumSnapshotEntry[];

type EnumLike = Record<string, string | number>;

const PROTOBUF_PREFIX = "protobuf:";

function isEnumLike(v: unknown): v is EnumLike {
    if (typeof v !== "object" || v === null || Array.isArray(v)) {
        return false;
    }
    const entries = Object.values(v as Record<string, unknown>);
    if (entries.length === 0) {
        return false;
    }
    return entries.every(x => typeof x === "string" || typeof x === "number");
}

function fromEnum(enumObject: EnumLike): EnumSnapshotEntry[] {
    return Object.entries(enumObject)
        .filter(([key]) => Number.isNaN(Number(key)))
        .map(([name, value]) => ({name, value}));
}

function buildRegistry(source: object): Record<string, EnumLike> {
    const registry: Record<string, EnumLike> = {};
    for (const [name, value] of Object.entries(source)) {
        if (isEnumLike(value)) {
            registry[name] = value;
        }
    }
    return registry;
}

const FRONTEND_REGISTRY: Record<string, EnumLike> = buildRegistry(FrontendEnums);
const PROTOBUF_REGISTRY: Record<string, EnumLike> = buildRegistry(CARTA);
const SNAPSHOT_NAMES: string[] = [...Object.keys(FRONTEND_REGISTRY), ...Object.keys(PROTOBUF_REGISTRY).map(name => `${PROTOBUF_PREFIX}${name}`)].sort();

export const ListEnumSnapshots = (): string[] => [...SNAPSHOT_NAMES];

export const GetEnumSnapshots = (names: string[]): EnumSnapshot[] =>
    names.map(name => {
        const isProtobufEnum = name.startsWith(PROTOBUF_PREFIX);
        const registry = isProtobufEnum ? PROTOBUF_REGISTRY : FRONTEND_REGISTRY;
        const registryName = isProtobufEnum ? name.slice(PROTOBUF_PREFIX.length) : name;
        const enumObject = registry[registryName];
        if (!enumObject) {
            throw new Error(`Unknown enum '${name}'.`);
        }
        return fromEnum(enumObject);
    });
