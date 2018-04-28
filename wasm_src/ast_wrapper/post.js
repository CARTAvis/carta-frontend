addOnPostRun(function() {
    console.log("AST WebAssembly module loaded");
});

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