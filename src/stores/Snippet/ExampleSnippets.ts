export const exampleSnippets: {name: string; section?: string; code: string}[] = [
    {
        name: "01. Quick start",
        section: "Tutorial",
        code: `// 01. Quick start

// # Loading images

// CARTA functions and objects can be accessed via the top-level "app" object
// (or the "carta" alias).
carta.showSplashScreen(); // Display the welcome splash screen for 1000 ms
await carta.delay(1000);
app.hideSplashScreen(); // Close the welcome splash screen

// Images loaded in the frontend are referred as and registered in the "frames"
// array which contains each frame (i.e., image) as a "FrameStore" object. The
// currently active frame is accessible with "activeFrame".
console.log(app.frames); // List the frames array
console.log(app.frames[0]); // List the 0th frame
console.log(app.activeFrame); // List the current active frame

// "openFile" takes up to three arguments: directory, filename and HDU. If no HDU
// is provided, the first HDU ("0") is adopted. The directory and filename can
// also be combined into a single argument. "openFile" must be called with "await",
// as it is anasynchronous function that requires communicating with the backend.
// In the following example, in the end we will see that only the last image is
// loaded as each "openFile" will close all loaded image first before loading the
// target image.
await app.openFile("test_directory", "testfile.fits", "0");
await app.openFile("test_directory", "testfile.fits");
await app.openFile("test_directory/testfile.fits");

// Additional images can be appended using "appendFile". The arguments are the
// same as "openFile".
// In the following example, in the end there will be three images loaded.
const file1 = await app.openFile("testfile1.fits");
const file2 = await app.appendFile("testfile2.fits");
const file3 = await app.appendFile("testfile3.fits");

// The active image can be changed with "setActiveFrame", as well as the wrapper
// functions "setActiveFrameById" and "setActiveFrameByIndex".
app.setActiveFrameByIndex(0);
app.setActiveFrameById(file2.frameInfo.fileId);
app.setActiveFrame(file3);

// # Closing images

// "closeCurrentFile" closes the active image. There will be no user confirmation
// if the active image serves as the spatial reference image and there are other
// images matched to it.
app.closeCurrentFile();

// "closeFile" takes an optional boolean argument to control whether user
// confirmation is required if other images are matched to the given file. This
// defaults to true. "await" is required to delay execution until the user confirms.
await app.closeFile(file1);
app.closeFile(file1, false); // No user confirmation

// "closeOtherFiles" closes all images other than the given file.
app.closeOtherFiles(file2);`
    },
    {
        name: "02. Basics",
        section: "Tutorial",
        code: `// 02. Basics

// Code snippets are regular ES6-based JavaScript (JS) code blocks.
// Lines starting with "//" are treated as comments.
/* you can also comment in
 * multiple lines using C-style comments
 */

// To log to the development console, use "console.log".
console.log("hello world");

// Variables can be defined using "let" (mutable) or "const" (immutable).
let x = 1;
const y = "hello world";
x += 15;

// # Functions

// Functions can be defined in a number of ways.
function squared(x) {
    return x * x;
}

const cubed = x => x * x * x; // This is an arrow function

const sqrt = x => { // This is an arrow function with a block of codes
    // You can use builtin JS library functions
    return Math.sqrt(x);
};

// Functions can also be asynchronous. 
// Any functions that wait for user input or interact with the
// backend will be asynchronous.
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
// or at the top level.
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

// Asynchronous functions can also be used with promise syntax.
delay(100).then(() => console.log("Looks promising"));
delay(-100).catch(err => console.log(err));

// Note that the response to the first "delay" call is printed after
// the second one, because execution is non-blocking.`
    },
    {
        name: "03. Image properties",
        section: "Tutorial",
        code: `// 03. Image properties

// load an image
const file = await app.openFile("my_image.fits");

// # Changing field of view

// set the center of the image
// image coordinate
file.setCenter([x position], [y position]);
// world coordinate
file.setCenterWcs("[x position, ex: 0:00:00.0615838925]", "[y position, ex: 29:59:59.1999990820]");

// zoom the image to fit the widget size
file.fitZoom();

// zoom the image to a specific scale
// image coordinate
file.zoomToSizeX([size in x direction]);
file.zoomToSizeY([size in y direction]);
// world coordinate
file.zoomToSizeXWcs('[size in x direction, ex: 2.56"]');
file.zoomToSizeYWcs('[size in y direction, ex: 2.56"]');

// # Changing the channel and Stokes

// change the channel of the image
file.setChannel([channel]);

// change the stokes of the image
file.setStokes(2); // Stokes Q
file.setStokesByIndex(2); // The third polarization shown in the animator widget

// # Changing render configuration

// change the rendering range
file.renderConfig.setCustomScale([clip min], [clip max]);
file.renderConfig.setPercentileRank(90); // Change to 90%

// change the scaling functions
file.renderConfig.setScaling(1); // Log

// change the color map
file.renderConfig.setColorMap("gray");
file.renderConfig.setInverted(true);`
    },
    {
        name: "04. Regions",
        section: "Tutorial",
        code: `// 04. Regions

// load an image
const file = await app.openFile("my_image.fits");

// # Creating regions

// Regions on a specific image is accessible via "RegionSetStore" under each image.
// Each region is represented by a "RegionStore" object.
console.log(file.regionSet.regions); // View all regions
console.log(file.regionSet.selectedRegion); // View the selected region

// create regions on a specific image
const regionSet = file.regionSet;
const region = regionSet.addRectangularRegion({x: [center x], y: [center y]}, [width], [height]);
const region2 = regionSet.addLineRegion([{x: [start x], y: [start y]}, {x: [end x], y: [end y]}]);

// # Changing region properties

// Properties of a region can be modified using the "RegionStore" object.
// ex: a rectangle region
region.setCenter({x: 0, y: 0}); // Move the region to position (0, 0)
region.setSize({x: 100, y: 100}); // Resize to 100 x 100 pixels
region.setColor("#ffffff"); // Change the color to white

// # Importing regions

// "importRegion" imports regions to the active image with the provided path,
// filename, and file type enum.
await app.importRegion("[path]", "[filename]", 1); // File type: CRTF`
    }
];
