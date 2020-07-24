declare var Module: any;
// Override module locateFile method
Module["locateFile"] = (path: string, prefix: string) => {
    return `./${path}`;
};