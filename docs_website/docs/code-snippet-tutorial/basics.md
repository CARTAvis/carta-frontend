---
sidebar_position: 2
---

# Basics

Code snippets are regular ES6-based JavaScript (JS) code blocks.

Lines starting with "//" are treated as comments. You can also comment in multiple lines using C-style comments.

```javascript
// Lines starting with "//" are treated as comments.
/* you can also comment in
 * multiple lines using C-style comments
 */
```

To log to the development console, use `console.log`.

```javascript
console.log("hello world");
```

Variables can be defined using `let` (mutable) or `const` (immutable).

```javascript
let x = 1;
const y = "hello world";
x += 15;
```

## Functions

Functions can be defined in a number of ways.

```javascript
function squared(x) {
    return x * x;
}

// This is an arrow function
const cubed = x => x * x * x;

// This is an arrow function with a block of codes
const sqrt = x => {
    // You can use builtin JS library functions
    return Math.sqrt(x);
};
```

Functions can also be asynchronous. Any functions that wait for user input or interact with the backend will be asynchronous.

```javascript
function delay(time) {
    return new Promise((resolve, reject) => {
        if (time < 0) {
            reject("Invalid delay duration");
        } else {
            setTimeout(resolve, time);
        }
    });
}
```

You can `await` asynchronous functions within another async function, or at the top level.

```javascript
async function pauseForOneSecond() {
    await delay(1000);
    return true;
}
```

Awaiting is necessary to ensure that return values can be used correctly. Compare the following outputs:

```javascript
console.log("Awaiting properly:");
const resultWithAwait = await pauseForOneSecond();
console.log(resultWithAwait);
console.log();

console.log("No await:");
const resultWithoutAwait = pauseForOneSecond();
console.log(resultWithoutAwait);
console.log();
```

Asynchronous functions can also be used with promise syntax.

```javascript
delay(100).then(() => console.log("Looks promising"));
delay(-100).catch(err => console.log(err));
```

Note that the response to the first "delay" call is printed after the second one, because execution is non-blocking.
