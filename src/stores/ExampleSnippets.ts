export const exampleSnippets: {name: string; section?: string; code: string}[] = [
    {
        name: "01. Basics",
        section: "Tutorial",
        code: `// 01. Basics

// Code snippets are regular ES6-based JavaScript (JS) code blocks
// Any valid JS should work.
// Lines starting with "//" are treated as comments.
/* you can also comment in 
* multiple lines using C-style comments
*/

// To log to the development console, use console.log
console.log("hello world");

// Variables can be defined using let/const
let x = 1;
const y = "hello world";
x += 15;`
    },
    {
        name: "02. Functions",
        section: "Tutorial",
        code: `// 02. Functions

// Functions can be defined in a number of ways
function squared (x) {
    return x * x;
}

const cubed = (x) => x * x * x;

const sqrt = (x) => {
    // You can use and builtin JS library functions
    return Math.sqrt(x);
}

// Functions can also be asynchronous. 
// Any functions that wait for user input or interact with the
// backend will be asynchronous
function delay(time) {
    return new Promise((resolve, reject) => {
        if (time < 0) {
            reject("Invalid delay duration");
        } else {
            setTimeout(resolve, time);
        }
    });
}

// You can "await" asynchronous functions within another async function,
// or at the top level
async function pauseForOneSecond() {
    await delay(1000);
    return true;
}

// Awaiting is necessary to ensure that return values can be used correctly.
// Compare the following outputs:
console.log("Awaiting properly:"); 
const resultWithAwait = await pauseForOneSecond();
console.log(resultWithAwait);
console.log();

console.log("No await:");
const resultWithoutAwait = pauseForOneSecond();
console.log(resultWithoutAwait);
console.log();

// Asynchronous functions can also be used with promise syntax:
delay(100).then(() => console.log("Looks promising"));
delay(-100).catch(err => console.log(err));

// Notice that the response to the first "delay" call is printed after
// the second one, because execution is non-blocking`
    },
    {
        name: "03. Loading images",
        section: "Tutorial",
        code: `// 03. Loading images

// CARTA functions and objects can be accessed via the top-level "app" object
// (or the "carta" alias).
carta.showSplashScreen();
await carta.delay(1000);
app.hideSplashScreen();

// Images in the frontend are referred to as frames. Each frame is represented
// by a FrameStore object, accessible via the array "frames". The currently
// active frame is accessible at "activeFrame".
console.log(app.frames);
console.log(app.activeFrame);

// "openFile" takes up to three arguments: directory, filename and HDU
// If no HDU is provided, the first HDU is provided. The directory and filename can
// also be combined into a single argument. "openFile" must be called with "await",
// as it is an asynchronous function that requires communicating with the backend.
await app.openFile("test_directory", "testfile.fits", "0");
await app.openFile("test_directory", "testfile.fits");
await app.openFile("test_directory/testfile.fits");

// Additional images can be appended using "appendFile". The arguments are the
// same as "openFile".
const file1 = await app.openFile("testfile1.fits");
const file2 = await app.appendFile("testfile2.fits");
const file3 = await app.appendFile("testfile3.fits");

// The active image can be changed with "setActiveImage", as well as the wrapper
// functions "setActiveImageById" and "setActiveImageByIndex".
app.setActiveFrameByIndex(0);
app.setActiveFrameById(file2.frameInfo.fileId);
app.setActiveFrame(file3);

// "closeCurrentFile" closes the active image.
app.closeCurrentFile();

// "closeFile" takes an optional argument controlling whether user confirmation is
// required if other images are matched to the given file. This defaults to true.
// "await" is required to delay execution until the user confirms.
await app.closeFile(file1);

// "closeOtherFiles" closes all images other than the given file.
app.closeOtherFiles(file2);`
    }
];
