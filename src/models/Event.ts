import {CARTA} from "carta-protobuf";

// class Event is a simple wrapper for CARTA.EventType
export class Event {
    public static isEventTypeValid = (eventType: CARTA.EventType): boolean => {
        return eventType && Object.values(CARTA.EventType).includes(eventType);
    };

    public static getEventNumber = (): number => {
        return Object.keys(CARTA.EventType).length;
    };

    public static getEventType = (eventName: string): CARTA.EventType => {
        return CARTA.EventType[eventName];
    };

    public static getEventName = (eventType: CARTA.EventType): string => {
        return CARTA.EventType[eventType];
    };

    public static getEventTypes = (): CARTA.EventType[] => {
        return Object.values(CARTA.EventType);
    };
}