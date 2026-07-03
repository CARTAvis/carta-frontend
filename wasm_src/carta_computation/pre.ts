declare var Module: any;
// Override module locateFile method
Module["locateFile"] = (path: string, _prefix: string) => {
    return _prefix + path;
};
