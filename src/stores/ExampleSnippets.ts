export const exampleSnippets: {name: string; section?: string; code: string}[] = [
    {
        name: "01. Basics",
        section: "Tutorial",
        code: `// 01. Tutorial/Basics

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
        code: `// 02. Tutorial/Functions

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
async function pauseForOneSecond(){
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
delay(100).then(()=>console.log("Looks promising"));
delay(-100).catch(err=>console.log(err));

// Notice that the response to the first "delay" call is printed after
// the second one, because execution is non-blocking`
    }
];
