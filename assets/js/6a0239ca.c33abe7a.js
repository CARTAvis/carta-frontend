"use strict";(self.webpackChunkcarta_frontend_docs=self.webpackChunkcarta_frontend_docs||[]).push([[178],{3905:(e,t,n)=>{n.d(t,{Zo:()=>u,kt:()=>f});var r=n(7294);function a(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function o(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function s(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?o(Object(n),!0).forEach((function(t){a(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):o(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function i(e,t){if(null==e)return{};var n,r,a=function(e,t){if(null==e)return{};var n,r,a={},o=Object.keys(e);for(r=0;r<o.length;r++)n=o[r],t.indexOf(n)>=0||(a[n]=e[n]);return a}(e,t);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);for(r=0;r<o.length;r++)n=o[r],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(a[n]=e[n])}return a}var l=r.createContext({}),c=function(e){var t=r.useContext(l),n=t;return e&&(n="function"==typeof e?e(t):s(s({},t),e)),n},u=function(e){var t=c(e.components);return r.createElement(l.Provider,{value:t},e.children)},p="mdxType",d={inlineCode:"code",wrapper:function(e){var t=e.children;return r.createElement(r.Fragment,{},t)}},m=r.forwardRef((function(e,t){var n=e.components,a=e.mdxType,o=e.originalType,l=e.parentName,u=i(e,["components","mdxType","originalType","parentName"]),p=c(n),m=a,f=p["".concat(l,".").concat(m)]||p[m]||d[m]||o;return n?r.createElement(f,s(s({ref:t},u),{},{components:n})):r.createElement(f,s({ref:t},u))}));function f(e,t){var n=arguments,a=t&&t.mdxType;if("string"==typeof e||a){var o=n.length,s=new Array(o);s[0]=m;var i={};for(var l in t)hasOwnProperty.call(t,l)&&(i[l]=t[l]);i.originalType=e,i[p]="string"==typeof e?e:a,s[1]=i;for(var c=2;c<o;c++)s[c]=n[c];return r.createElement.apply(null,s)}return r.createElement.apply(null,n)}m.displayName="MDXCreateElement"},4900:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>l,contentTitle:()=>s,default:()=>d,frontMatter:()=>o,metadata:()=>i,toc:()=>c});var r=n(7462),a=(n(7294),n(3905));const o={sidebar_position:2},s="Basics",i={unversionedId:"code-snippet-tutorial/basics",id:"code-snippet-tutorial/basics",title:"Basics",description:"Code snippets are regular ES6-based JavaScript (JS) code blocks.",source:"@site/docs/code-snippet-tutorial/basics.md",sourceDirName:"code-snippet-tutorial",slug:"/code-snippet-tutorial/basics",permalink:"/carta-frontend/docs/code-snippet-tutorial/basics",draft:!1,tags:[],version:"current",sidebarPosition:2,frontMatter:{sidebar_position:2},sidebar:"docsSidebar",previous:{title:"Quick start",permalink:"/carta-frontend/docs/code-snippet-tutorial/quick-start"},next:{title:"Image properties",permalink:"/carta-frontend/docs/code-snippet-tutorial/image-properties"}},l={},c=[{value:"Functions",id:"functions",level:2}],u={toc:c},p="wrapper";function d(e){let{components:t,...n}=e;return(0,a.kt)(p,(0,r.Z)({},u,n,{components:t,mdxType:"MDXLayout"}),(0,a.kt)("h1",{id:"basics"},"Basics"),(0,a.kt)("p",null,"Code snippets are regular ES6-based JavaScript (JS) code blocks."),(0,a.kt)("p",null,'Lines starting with "//" are treated as comments. You can also comment in multiple lines using C-style comments.'),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-javascript"},'// Lines starting with "//" are treated as comments.\n/* you can also comment in\n * multiple lines using C-style comments\n */\n')),(0,a.kt)("p",null,"To log to the development console, use ",(0,a.kt)("inlineCode",{parentName:"p"},"console.log"),"."),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-javascript"},'console.log("hello world");\n')),(0,a.kt)("p",null,"Variables can be defined using ",(0,a.kt)("inlineCode",{parentName:"p"},"let")," (mutable) or ",(0,a.kt)("inlineCode",{parentName:"p"},"const")," (immutable)."),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-javascript"},'let x = 1;\nconst y = "hello world";\nx += 15;\n')),(0,a.kt)("h2",{id:"functions"},"Functions"),(0,a.kt)("p",null,"Functions can be defined in a number of ways."),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-javascript"},"function squared(x) {\n    return x * x;\n}\n\n// This is an arrow function\nconst cubed = x => x * x * x;\n\n// This is an arrow function with a block of codes\nconst sqrt = x => {\n    // You can use builtin JS library functions\n    return Math.sqrt(x);\n};\n")),(0,a.kt)("p",null,"Functions can also be asynchronous. Any functions that wait for user input or interact with the backend will be asynchronous."),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-javascript"},'function delay(time) {\n    return new Promise((resolve, reject) => {\n        if (time < 0) {\n            reject("Invalid delay duration");\n        } else {\n            setTimeout(resolve, time);\n        }\n    });\n}\n')),(0,a.kt)("p",null,"You can ",(0,a.kt)("inlineCode",{parentName:"p"},"await")," asynchronous functions within another async function, or at the top level."),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-javascript"},"async function pauseForOneSecond() {\n    await delay(1000);\n    return true;\n}\n")),(0,a.kt)("p",null,"Awaiting is necessary to ensure that return values can be used correctly. Compare the following outputs:"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-javascript"},'console.log("Awaiting properly:");\nconst resultWithAwait = await pauseForOneSecond();\nconsole.log(resultWithAwait);\nconsole.log();\n\nconsole.log("No await:");\nconst resultWithoutAwait = pauseForOneSecond();\nconsole.log(resultWithoutAwait);\nconsole.log();\n')),(0,a.kt)("p",null,"Asynchronous functions can also be used with promise syntax."),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-javascript"},'delay(100).then(() => console.log("Looks promising"));\ndelay(-100).catch(err => console.log(err));\n')),(0,a.kt)("p",null,'Note that the response to the first "delay" call is printed after the second one, because execution is non-blocking.'),(0,a.kt)("p",null,"For more usages of ES6-based JavaScript, please refer to the features of the language."))}d.isMDXComponent=!0}}]);