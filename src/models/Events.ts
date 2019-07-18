import {CARTA} from "carta-protobuf";

export class Events {
    static readonly EVENT_NAMES = new Map<CARTA.EventType, string>([
        [CARTA.EventType.REGISTER_VIEWER, "REGISTER_VIEWER"],
        [CARTA.EventType.REGISTER_VIEWER_ACK, "REGISTER_VIEWER_ACK"],
        [CARTA.EventType.FILE_LIST_RESPONSE, "FILE_LIST_RESPONSE"],
        [CARTA.EventType.FILE_INFO_RESPONSE, "FILE_INFO_RESPONSE"],
        [CARTA.EventType.OPEN_FILE, "OPEN_FILE"],
        [CARTA.EventType.OPEN_FILE_ACK, "OPEN_FILE_ACK"],
        [CARTA.EventType.SET_REGION_ACK, "SET_REGION_ACK"],
        [CARTA.EventType.START_ANIMATION_ACK, "START_ANIMATION_ACK"],
        [CARTA.EventType.RASTER_IMAGE_DATA, "RASTER_IMAGE_DATA"],
        [CARTA.EventType.RASTER_TILE_DATA, "RASTER_TILE_DATA"],
        [CARTA.EventType.REGION_HISTOGRAM_DATA, "REGION_HISTOGRAM_DATA"],
        [CARTA.EventType.ERROR_DATA, "ERROR_DATA"],
        [CARTA.EventType.SPATIAL_PROFILE_DATA, "SPATIAL_PROFILE_DATA"],
        [CARTA.EventType.SPECTRAL_PROFILE_DATA, "SPECTRAL_PROFILE_DATA"],
        [CARTA.EventType.REGION_STATS_DATA, "REGION_STATS_DATA"]
    ]);

    public static getEvents = (): CARTA.EventType[] => {
        return Array.from(Events.EVENT_NAMES.keys());
    };

    public static getEventName = (key: CARTA.EventType): string => {
        return Events.EVENT_NAMES.get(key);
    };
}