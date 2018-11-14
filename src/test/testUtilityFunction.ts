/// Toollet functions

/// Transfer functionality from String to Uint8Array
export function stringToUint8Array(str: string, padLength: number): Uint8Array {
    const bytes = new Uint8Array(padLength);
    for (let i = 0; i < Math.min(str.length, padLength); i++) {
        const charCode = str.charCodeAt(i);
        bytes[i] = (charCode <= 0xFF ? charCode : 0);
    }
    return bytes;
}
/// Transfer functionality from Uint8Array to String
export function getEventName(byteArray: Uint8Array): String {
    if (!byteArray || byteArray.length < 32) {
        return "";
    }
    const nullIndex = byteArray.indexOf(0);
    if (nullIndex >= 0) {
        byteArray = byteArray.slice(0, byteArray.indexOf(0));
    }
    return String.fromCharCode.apply(null, byteArray);
}
/// Temporary cease the process
export function sleep(miliseconds: number) {
    var currentTime = new Date().getTime();
 
    while (currentTime + miliseconds >= new Date().getTime()) {
        // Dry run
    }
 }