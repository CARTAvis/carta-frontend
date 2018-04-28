addOnPostRun(function() {
    console.log("AST WebAssembly module loaded");
});

Module.plot = Module.cwrap('plotCustomGrid', 'number', Array(19).fill("number"));
Module.initFrame = Module.cwrap('initFrame', 'number', ['string']);

Module.ready = new Promise(function (func) {
    if (Module['calledRun']) {
        func(Module);
    } else {
        const old = Module['onRuntimeInitialized'];
        Module['onRuntimeInitialized'] = function () {
            if (old){
                old();
            }
            func(Module);
        };
    }
});

module.exports = Module;