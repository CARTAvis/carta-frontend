(self.webpackChunkcarta_frontend_docs=self.webpackChunkcarta_frontend_docs||[]).push([[9927],{3905:(e,t,n)=>{"use strict";n.d(t,{Zo:()=>u,kt:()=>f});var a=n(7294);function o(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function r(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);t&&(a=a.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,a)}return n}function l(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?r(Object(n),!0).forEach((function(t){o(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):r(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function c(e,t){if(null==e)return{};var n,a,o=function(e,t){if(null==e)return{};var n,a,o={},r=Object.keys(e);for(a=0;a<r.length;a++)n=r[a],t.indexOf(n)>=0||(o[n]=e[n]);return o}(e,t);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);for(a=0;a<r.length;a++)n=r[a],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(o[n]=e[n])}return o}var i=a.createContext({}),s=function(e){var t=a.useContext(i),n=t;return e&&(n="function"==typeof e?e(t):l(l({},t),e)),n},u=function(e){var t=s(e.components);return a.createElement(i.Provider,{value:t},e.children)},m="mdxType",d={inlineCode:"code",wrapper:function(e){var t=e.children;return a.createElement(a.Fragment,{},t)}},p=a.forwardRef((function(e,t){var n=e.components,o=e.mdxType,r=e.originalType,i=e.parentName,u=c(e,["components","mdxType","originalType","parentName"]),m=s(n),p=o,f=m["".concat(i,".").concat(p)]||m[p]||d[p]||r;return n?a.createElement(f,l(l({ref:t},u),{},{components:n})):a.createElement(f,l({ref:t},u))}));function f(e,t){var n=arguments,o=t&&t.mdxType;if("string"==typeof e||o){var r=n.length,l=new Array(r);l[0]=p;var c={};for(var i in t)hasOwnProperty.call(t,i)&&(c[i]=t[i]);c.originalType=e,c[m]="string"==typeof e?e:o,l[1]=c;for(var s=2;s<r;s++)l[s]=n[s];return a.createElement.apply(null,l)}return a.createElement.apply(null,n)}p.displayName="MDXCreateElement"},1310:(e,t,n)=>{"use strict";n.r(t),n.d(t,{default:()=>v});var a=n(7462),o=n(7294),r=n(6010),l=n(5281),c=n(3438),i=n(8596),s=n(9960),u=n(5999),m=n(4996);function d(e){return o.createElement("svg",(0,a.Z)({viewBox:"0 0 24 24"},e),o.createElement("path",{d:"M10 19v-5h4v5c0 .55.45 1 1 1h3c.55 0 1-.45 1-1v-7h1.7c.46 0 .68-.57.33-.87L12.67 3.6c-.38-.34-.96-.34-1.34 0l-8.36 7.53c-.34.3-.13.87.33.87H5v7c0 .55.45 1 1 1h3c.55 0 1-.45 1-1z",fill:"currentColor"}))}const p={breadcrumbHomeIcon:"breadcrumbHomeIcon_YNFT"};function f(){const e=(0,m.Z)("/");return o.createElement("li",{className:"breadcrumbs__item"},o.createElement(s.default,{"aria-label":(0,u.I)({id:"theme.docs.breadcrumbs.home",message:"Home page",description:"The ARIA label for the home page in the breadcrumbs"}),className:"breadcrumbs__link",href:e},o.createElement(d,{className:p.breadcrumbHomeIcon})))}const h={breadcrumbsContainer:"breadcrumbsContainer_Z_bl"};function b(e){let{children:t,href:n,isLast:a}=e;const r="breadcrumbs__link";return a?o.createElement("span",{className:r,itemProp:"name"},t):n?o.createElement(s.default,{className:r,href:n,itemProp:"item"},o.createElement("span",{itemProp:"name"},t)):o.createElement("span",{className:r},t)}function g(e){let{children:t,active:n,index:l,addMicrodata:c}=e;return o.createElement("li",(0,a.Z)({},c&&{itemScope:!0,itemProp:"itemListElement",itemType:"https://schema.org/ListItem"},{className:(0,r.Z)("breadcrumbs__item",{"breadcrumbs__item--active":n})}),t,o.createElement("meta",{itemProp:"position",content:String(l+1)}))}function v(){const e=(0,c.s1)(),t=(0,i.Ns)();return e?o.createElement("nav",{className:(0,r.Z)(l.k.docs.docBreadcrumbs,h.breadcrumbsContainer),"aria-label":(0,u.I)({id:"theme.docs.breadcrumbs.navAriaLabel",message:"Breadcrumbs",description:"The ARIA label for the breadcrumbs"})},o.createElement("ul",{className:"breadcrumbs",itemScope:!0,itemType:"https://schema.org/BreadcrumbList"},t&&o.createElement(f,null),e.map(((t,n)=>{const a=n===e.length-1;return o.createElement(g,{key:n,active:a,index:n,addMicrodata:!!t.href},o.createElement(b,{href:t.href,isLast:a},t.label))})))):null}},4966:(e,t,n)=>{"use strict";n.r(t),n.d(t,{default:()=>s});var a=n(7462),o=n(7294),r=n(5999),l=n(6010),c=n(9960);function i(e){const{permalink:t,title:n,subLabel:a,isNext:r}=e;return o.createElement(c.default,{className:(0,l.Z)("pagination-nav__link",r?"pagination-nav__link--next":"pagination-nav__link--prev"),to:t},a&&o.createElement("div",{className:"pagination-nav__sublabel"},a),o.createElement("div",{className:"pagination-nav__label"},n))}function s(e){const{previous:t,next:n}=e;return o.createElement("nav",{className:"pagination-nav docusaurus-mt-lg","aria-label":(0,r.I)({id:"theme.docs.paginator.navAriaLabel",message:"Docs pages",description:"The ARIA label for the docs pagination"})},t&&o.createElement(i,(0,a.Z)({},t,{subLabel:o.createElement(r.Z,{id:"theme.docs.paginator.previous",description:"The label used to navigate to the previous doc"},"Previous")})),n&&o.createElement(i,(0,a.Z)({},n,{subLabel:o.createElement(r.Z,{id:"theme.docs.paginator.next",description:"The label used to navigate to the next doc"},"Next"),isNext:!0})))}},4364:(e,t,n)=>{"use strict";n.r(t),n.d(t,{default:()=>i});var a=n(7294),o=n(6010),r=n(5999),l=n(5281),c=n(4477);function i(e){let{className:t}=e;const n=(0,c.E)();return n.badge?a.createElement("span",{className:(0,o.Z)(t,l.k.docs.docVersionBadge,"badge badge--secondary")},a.createElement(r.Z,{id:"theme.docs.versionBadge.label",values:{versionLabel:n.label}},"Version: {versionLabel}")):null}},2503:(e,t,n)=>{"use strict";n.r(t),n.d(t,{default:()=>u});var a=n(7462),o=n(7294),r=n(6010),l=n(5999),c=n(6668),i=n(9960);const s={anchorWithStickyNavbar:"anchorWithStickyNavbar_LWe7",anchorWithHideOnScrollNavbar:"anchorWithHideOnScrollNavbar_WYt5"};function u(e){let{as:t,id:n,...u}=e;const{navbar:{hideOnScroll:m}}=(0,c.L)();if("h1"===t||!n)return o.createElement(t,(0,a.Z)({},u,{id:void 0}));const d=(0,l.I)({id:"theme.common.headingLinkTitle",message:"Direct link to {heading}",description:"Title for link to heading"},{heading:"string"==typeof u.children?u.children:n});return o.createElement(t,(0,a.Z)({},u,{className:(0,r.Z)("anchor",m?s.anchorWithHideOnScrollNavbar:s.anchorWithStickyNavbar,u.className),id:n}),u.children,o.createElement(i.default,{className:"hash-link",to:`#${n}`,"aria-label":d,title:d},"\u200b"))}},1862:(e,t,n)=>{"use strict";n.d(t,{Z:()=>le});var a=n(7462),o=n(7294),r=n(5742);var l=n(2389),c=n(6010),i=n(6412),s=n(5281),u=n(7016);const m={codeBlockContainer:"codeBlockContainer_Ckt0"};function d(e){let{as:t,...n}=e;const r=(0,i.p)(),l=(0,u.QC)(r);return o.createElement(t,(0,a.Z)({},n,{style:l,className:(0,c.Z)(n.className,m.codeBlockContainer,s.k.common.codeBlock)}))}const p={codeBlockContent:"codeBlockContent_biex",codeBlockTitle:"codeBlockTitle_Ktv7",codeBlock:"codeBlock_bY9V",codeBlockStandalone:"codeBlockStandalone_MEMb",codeBlockLines:"codeBlockLines_e6Vv",codeBlockLinesWithNumbering:"codeBlockLinesWithNumbering_o6Pm",buttonGroup:"buttonGroup__atx"};function f(e){let{children:t,className:n}=e;return o.createElement(d,{as:"pre",tabIndex:0,className:(0,c.Z)(p.codeBlockStandalone,"thin-scrollbar",n)},o.createElement("code",{className:p.codeBlockLines},t))}var h=n(6668),b=n(5448);const g={plain:{backgroundColor:"#2a2734",color:"#9a86fd"},styles:[{types:["comment","prolog","doctype","cdata","punctuation"],style:{color:"#6c6783"}},{types:["namespace"],style:{opacity:.7}},{types:["tag","operator","number"],style:{color:"#e09142"}},{types:["property","function"],style:{color:"#9a86fd"}},{types:["tag-id","selector","atrule-id"],style:{color:"#eeebff"}},{types:["attr-name"],style:{color:"#c4b9fe"}},{types:["boolean","string","entity","url","attr-value","keyword","control","directive","unit","statement","regex","atrule","placeholder","variable"],style:{color:"#ffcc99"}},{types:["deleted"],style:{textDecorationLine:"line-through"}},{types:["inserted"],style:{textDecorationLine:"underline"}},{types:["italic"],style:{fontStyle:"italic"}},{types:["important","bold"],style:{fontWeight:"bold"}},{types:["important"],style:{color:"#c4b9fe"}}]};var v={Prism:n(7410).Z,theme:g};function y(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function E(){return E=Object.assign||function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var a in n)Object.prototype.hasOwnProperty.call(n,a)&&(e[a]=n[a])}return e},E.apply(this,arguments)}var k=/\r\n|\r|\n/,C=function(e){0===e.length?e.push({types:["plain"],content:"\n",empty:!0}):1===e.length&&""===e[0].content&&(e[0].content="\n",e[0].empty=!0)},N=function(e,t){var n=e.length;return n>0&&e[n-1]===t?e:e.concat(t)};function L(e,t){var n={};for(var a in e)Object.prototype.hasOwnProperty.call(e,a)&&-1===t.indexOf(a)&&(n[a]=e[a]);return n}var x=function(e){function t(){for(var t=this,n=[],a=arguments.length;a--;)n[a]=arguments[a];e.apply(this,n),y(this,"getThemeDict",(function(e){if(void 0!==t.themeDict&&e.theme===t.prevTheme&&e.language===t.prevLanguage)return t.themeDict;t.prevTheme=e.theme,t.prevLanguage=e.language;var n=e.theme?function(e,t){var n=e.plain,a=Object.create(null),o=e.styles.reduce((function(e,n){var a=n.languages,o=n.style;return a&&!a.includes(t)||n.types.forEach((function(t){var n=E({},e[t],o);e[t]=n})),e}),a);return o.root=n,o.plain=E({},n,{backgroundColor:null}),o}(e.theme,e.language):void 0;return t.themeDict=n})),y(this,"getLineProps",(function(e){var n=e.key,a=e.className,o=e.style,r=E({},L(e,["key","className","style","line"]),{className:"token-line",style:void 0,key:void 0}),l=t.getThemeDict(t.props);return void 0!==l&&(r.style=l.plain),void 0!==o&&(r.style=void 0!==r.style?E({},r.style,o):o),void 0!==n&&(r.key=n),a&&(r.className+=" "+a),r})),y(this,"getStyleForToken",(function(e){var n=e.types,a=e.empty,o=n.length,r=t.getThemeDict(t.props);if(void 0!==r){if(1===o&&"plain"===n[0])return a?{display:"inline-block"}:void 0;if(1===o&&!a)return r[n[0]];var l=a?{display:"inline-block"}:{},c=n.map((function(e){return r[e]}));return Object.assign.apply(Object,[l].concat(c))}})),y(this,"getTokenProps",(function(e){var n=e.key,a=e.className,o=e.style,r=e.token,l=E({},L(e,["key","className","style","token"]),{className:"token "+r.types.join(" "),children:r.content,style:t.getStyleForToken(r),key:void 0});return void 0!==o&&(l.style=void 0!==l.style?E({},l.style,o):o),void 0!==n&&(l.key=n),a&&(l.className+=" "+a),l})),y(this,"tokenize",(function(e,t,n,a){var o={code:t,grammar:n,language:a,tokens:[]};e.hooks.run("before-tokenize",o);var r=o.tokens=e.tokenize(o.code,o.grammar,o.language);return e.hooks.run("after-tokenize",o),r}))}return e&&(t.__proto__=e),t.prototype=Object.create(e&&e.prototype),t.prototype.constructor=t,t.prototype.render=function(){var e=this.props,t=e.Prism,n=e.language,a=e.code,o=e.children,r=this.getThemeDict(this.props),l=t.languages[n];return o({tokens:function(e){for(var t=[[]],n=[e],a=[0],o=[e.length],r=0,l=0,c=[],i=[c];l>-1;){for(;(r=a[l]++)<o[l];){var s=void 0,u=t[l],m=n[l][r];if("string"==typeof m?(u=l>0?u:["plain"],s=m):(u=N(u,m.type),m.alias&&(u=N(u,m.alias)),s=m.content),"string"==typeof s){var d=s.split(k),p=d.length;c.push({types:u,content:d[0]});for(var f=1;f<p;f++)C(c),i.push(c=[]),c.push({types:u,content:d[f]})}else l++,t.push(u),n.push(s),a.push(0),o.push(s.length)}l--,t.pop(),n.pop(),a.pop(),o.pop()}return C(c),i}(void 0!==l?this.tokenize(t,a,l,n):[a]),className:"prism-code language-"+n,style:void 0!==r?r.root:{},getLineProps:this.getLineProps,getTokenProps:this.getTokenProps})},t}(o.Component);const B=x,_={codeLine:"codeLine_lJS_",codeLineNumber:"codeLineNumber_Tfdd",codeLineContent:"codeLineContent_feaV"};function T(e){let{line:t,classNames:n,showLineNumbers:r,getLineProps:l,getTokenProps:i}=e;1===t.length&&"\n"===t[0].content&&(t[0].content="");const s=l({line:t,className:(0,c.Z)(n,r&&_.codeLine)}),u=t.map(((e,t)=>o.createElement("span",(0,a.Z)({key:t},i({token:e,key:t})))));return o.createElement("span",s,r?o.createElement(o.Fragment,null,o.createElement("span",{className:_.codeLineNumber}),o.createElement("span",{className:_.codeLineContent},u)):u,o.createElement("br",null))}var w=n(5999);function Z(e){return o.createElement("svg",(0,a.Z)({viewBox:"0 0 24 24"},e),o.createElement("path",{fill:"currentColor",d:"M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"}))}function O(e){return o.createElement("svg",(0,a.Z)({viewBox:"0 0 24 24"},e),o.createElement("path",{fill:"currentColor",d:"M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"}))}const H={copyButtonCopied:"copyButtonCopied_obH4",copyButtonIcons:"copyButtonIcons_eSgA",copyButtonIcon:"copyButtonIcon_y97N",copyButtonSuccessIcon:"copyButtonSuccessIcon_LjdS"};function j(e){let{code:t,className:n}=e;const[a,r]=(0,o.useState)(!1),l=(0,o.useRef)(void 0),i=(0,o.useCallback)((()=>{!function(e,t){let{target:n=document.body}=void 0===t?{}:t;if("string"!=typeof e)throw new TypeError(`Expected parameter \`text\` to be a \`string\`, got \`${typeof e}\`.`);const a=document.createElement("textarea"),o=document.activeElement;a.value=e,a.setAttribute("readonly",""),a.style.contain="strict",a.style.position="absolute",a.style.left="-9999px",a.style.fontSize="12pt";const r=document.getSelection(),l=r.rangeCount>0&&r.getRangeAt(0);n.append(a),a.select(),a.selectionStart=0,a.selectionEnd=e.length;let c=!1;try{c=document.execCommand("copy")}catch{}a.remove(),l&&(r.removeAllRanges(),r.addRange(l)),o&&o.focus()}(t),r(!0),l.current=window.setTimeout((()=>{r(!1)}),1e3)}),[t]);return(0,o.useEffect)((()=>()=>window.clearTimeout(l.current)),[]),o.createElement("button",{type:"button","aria-label":a?(0,w.I)({id:"theme.CodeBlock.copied",message:"Copied",description:"The copied button label on code blocks"}):(0,w.I)({id:"theme.CodeBlock.copyButtonAriaLabel",message:"Copy code to clipboard",description:"The ARIA label for copy code blocks button"}),title:(0,w.I)({id:"theme.CodeBlock.copy",message:"Copy",description:"The copy button label on code blocks"}),className:(0,c.Z)("clean-btn",n,H.copyButton,a&&H.copyButtonCopied),onClick:i},o.createElement("span",{className:H.copyButtonIcons,"aria-hidden":"true"},o.createElement(Z,{className:H.copyButtonIcon}),o.createElement(O,{className:H.copyButtonSuccessIcon})))}function S(e){return o.createElement("svg",(0,a.Z)({viewBox:"0 0 24 24"},e),o.createElement("path",{fill:"currentColor",d:"M4 19h6v-2H4v2zM20 5H4v2h16V5zm-3 6H4v2h13.25c1.1 0 2 .9 2 2s-.9 2-2 2H15v-2l-3 3l3 3v-2h2c2.21 0 4-1.79 4-4s-1.79-4-4-4z"}))}const A={wordWrapButtonIcon:"wordWrapButtonIcon_Bwma",wordWrapButtonEnabled:"wordWrapButtonEnabled_EoeP"};function I(e){let{className:t,onClick:n,isEnabled:a}=e;const r=(0,w.I)({id:"theme.CodeBlock.wordWrapToggle",message:"Toggle word wrap",description:"The title attribute for toggle word wrapping button of code block lines"});return o.createElement("button",{type:"button",onClick:n,className:(0,c.Z)("clean-btn",t,a&&A.wordWrapButtonEnabled),"aria-label":r,title:r},o.createElement(S,{className:A.wordWrapButtonIcon,"aria-hidden":"true"}))}function P(e){let{children:t,className:n="",metastring:r,title:l,showLineNumbers:s,language:m}=e;const{prism:{defaultLanguage:f,magicComments:g}}=(0,h.L)(),y=m??(0,u.Vo)(n)??f,E=(0,i.p)(),k=(0,b.F)(),C=(0,u.bc)(r)||l,{lineClassNames:N,code:L}=(0,u.nZ)(t,{metastring:r,language:y,magicComments:g}),x=s??(0,u.nt)(r);return o.createElement(d,{as:"div",className:(0,c.Z)(n,y&&!n.includes(`language-${y}`)&&`language-${y}`)},C&&o.createElement("div",{className:p.codeBlockTitle},C),o.createElement("div",{className:p.codeBlockContent},o.createElement(B,(0,a.Z)({},v,{theme:E,code:L,language:y??"text"}),(e=>{let{className:t,tokens:n,getLineProps:a,getTokenProps:r}=e;return o.createElement("pre",{tabIndex:0,ref:k.codeBlockRef,className:(0,c.Z)(t,p.codeBlock,"thin-scrollbar")},o.createElement("code",{className:(0,c.Z)(p.codeBlockLines,x&&p.codeBlockLinesWithNumbering)},n.map(((e,t)=>o.createElement(T,{key:t,line:e,getLineProps:a,getTokenProps:r,classNames:N[t],showLineNumbers:x})))))})),o.createElement("div",{className:p.buttonGroup},(k.isEnabled||k.isCodeScrollable)&&o.createElement(I,{className:p.codeButton,onClick:()=>k.toggle(),isEnabled:k.isEnabled}),o.createElement(j,{className:p.codeButton,code:L}))))}function M(e){let{children:t,...n}=e;const r=(0,l.Z)(),c=function(e){return o.Children.toArray(e).some((e=>(0,o.isValidElement)(e)))?e:Array.isArray(e)?e.join(""):e}(t),i="string"==typeof c?P:f;return o.createElement(i,(0,a.Z)({key:String(r)},n),c)}var z=n(9960);var D=n(6043);const R={details:"details_lb9f",isBrowser:"isBrowser_bmU9",collapsibleContent:"collapsibleContent_i85q"};function V(e){return!!e&&("SUMMARY"===e.tagName||V(e.parentElement))}function W(e,t){return!!e&&(e===t||W(e.parentElement,t))}function $(e){let{summary:t,children:n,...r}=e;const i=(0,l.Z)(),s=(0,o.useRef)(null),{collapsed:u,setCollapsed:m}=(0,D.u)({initialState:!r.open}),[d,p]=(0,o.useState)(r.open),f=o.isValidElement(t)?t:o.createElement("summary",null,t??"Details");return o.createElement("details",(0,a.Z)({},r,{ref:s,open:d,"data-collapsed":u,className:(0,c.Z)(R.details,i&&R.isBrowser,r.className),onMouseDown:e=>{V(e.target)&&e.detail>1&&e.preventDefault()},onClick:e=>{e.stopPropagation();const t=e.target;V(t)&&W(t,s.current)&&(e.preventDefault(),u?(m(!1),p(!0)):m(!0))}}),f,o.createElement(D.z,{lazy:!1,collapsed:u,disableSSRStyle:!0,onCollapseTransitionEnd:e=>{m(e),p(!e)}},o.createElement("div",{className:R.collapsibleContent},n)))}const F={details:"details_b_Ee"},q="alert alert--info";function G(e){let{...t}=e;return o.createElement($,(0,a.Z)({},t,{className:(0,c.Z)(q,F.details,t.className)}))}var U=n(2503);function Q(e){return o.createElement(U.default,e)}const Y={containsTaskList:"containsTaskList_mC6p"};function X(e){if(void 0!==e)return(0,c.Z)(e,e?.includes("contains-task-list")&&Y.containsTaskList)}const J={img:"img_ev3q"};const K="admonition_LlT9",ee="admonitionHeading_tbUL",te="admonitionIcon_kALy",ne="admonitionContent_S0QG";const ae={note:{infimaClassName:"secondary",iconComponent:function(){return o.createElement("svg",{viewBox:"0 0 14 16"},o.createElement("path",{fillRule:"evenodd",d:"M6.3 5.69a.942.942 0 0 1-.28-.7c0-.28.09-.52.28-.7.19-.18.42-.28.7-.28.28 0 .52.09.7.28.18.19.28.42.28.7 0 .28-.09.52-.28.7a1 1 0 0 1-.7.3c-.28 0-.52-.11-.7-.3zM8 7.99c-.02-.25-.11-.48-.31-.69-.2-.19-.42-.3-.69-.31H6c-.27.02-.48.13-.69.31-.2.2-.3.44-.31.69h1v3c.02.27.11.5.31.69.2.2.42.31.69.31h1c.27 0 .48-.11.69-.31.2-.19.3-.42.31-.69H8V7.98v.01zM7 2.3c-3.14 0-5.7 2.54-5.7 5.68 0 3.14 2.56 5.7 5.7 5.7s5.7-2.55 5.7-5.7c0-3.15-2.56-5.69-5.7-5.69v.01zM7 .98c3.86 0 7 3.14 7 7s-3.14 7-7 7-7-3.12-7-7 3.14-7 7-7z"}))},label:o.createElement(w.Z,{id:"theme.admonition.note",description:"The default label used for the Note admonition (:::note)"},"note")},tip:{infimaClassName:"success",iconComponent:function(){return o.createElement("svg",{viewBox:"0 0 12 16"},o.createElement("path",{fillRule:"evenodd",d:"M6.5 0C3.48 0 1 2.19 1 5c0 .92.55 2.25 1 3 1.34 2.25 1.78 2.78 2 4v1h5v-1c.22-1.22.66-1.75 2-4 .45-.75 1-2.08 1-3 0-2.81-2.48-5-5.5-5zm3.64 7.48c-.25.44-.47.8-.67 1.11-.86 1.41-1.25 2.06-1.45 3.23-.02.05-.02.11-.02.17H5c0-.06 0-.13-.02-.17-.2-1.17-.59-1.83-1.45-3.23-.2-.31-.42-.67-.67-1.11C2.44 6.78 2 5.65 2 5c0-2.2 2.02-4 4.5-4 1.22 0 2.36.42 3.22 1.19C10.55 2.94 11 3.94 11 5c0 .66-.44 1.78-.86 2.48zM4 14h5c-.23 1.14-1.3 2-2.5 2s-2.27-.86-2.5-2z"}))},label:o.createElement(w.Z,{id:"theme.admonition.tip",description:"The default label used for the Tip admonition (:::tip)"},"tip")},danger:{infimaClassName:"danger",iconComponent:function(){return o.createElement("svg",{viewBox:"0 0 12 16"},o.createElement("path",{fillRule:"evenodd",d:"M5.05.31c.81 2.17.41 3.38-.52 4.31C3.55 5.67 1.98 6.45.9 7.98c-1.45 2.05-1.7 6.53 3.53 7.7-2.2-1.16-2.67-4.52-.3-6.61-.61 2.03.53 3.33 1.94 2.86 1.39-.47 2.3.53 2.27 1.67-.02.78-.31 1.44-1.13 1.81 3.42-.59 4.78-3.42 4.78-5.56 0-2.84-2.53-3.22-1.25-5.61-1.52.13-2.03 1.13-1.89 2.75.09 1.08-1.02 1.8-1.86 1.33-.67-.41-.66-1.19-.06-1.78C8.18 5.31 8.68 2.45 5.05.32L5.03.3l.02.01z"}))},label:o.createElement(w.Z,{id:"theme.admonition.danger",description:"The default label used for the Danger admonition (:::danger)"},"danger")},info:{infimaClassName:"info",iconComponent:function(){return o.createElement("svg",{viewBox:"0 0 14 16"},o.createElement("path",{fillRule:"evenodd",d:"M7 2.3c3.14 0 5.7 2.56 5.7 5.7s-2.56 5.7-5.7 5.7A5.71 5.71 0 0 1 1.3 8c0-3.14 2.56-5.7 5.7-5.7zM7 1C3.14 1 0 4.14 0 8s3.14 7 7 7 7-3.14 7-7-3.14-7-7-7zm1 3H6v5h2V4zm0 6H6v2h2v-2z"}))},label:o.createElement(w.Z,{id:"theme.admonition.info",description:"The default label used for the Info admonition (:::info)"},"info")},caution:{infimaClassName:"warning",iconComponent:function(){return o.createElement("svg",{viewBox:"0 0 16 16"},o.createElement("path",{fillRule:"evenodd",d:"M8.893 1.5c-.183-.31-.52-.5-.887-.5s-.703.19-.886.5L.138 13.499a.98.98 0 0 0 0 1.001c.193.31.53.501.886.501h13.964c.367 0 .704-.19.877-.5a1.03 1.03 0 0 0 .01-1.002L8.893 1.5zm.133 11.497H6.987v-2.003h2.039v2.003zm0-3.004H6.987V5.987h2.039v4.006z"}))},label:o.createElement(w.Z,{id:"theme.admonition.caution",description:"The default label used for the Caution admonition (:::caution)"},"caution")}},oe={secondary:"note",important:"info",success:"tip",warning:"danger"};function re(e){const{mdxAdmonitionTitle:t,rest:n}=function(e){const t=o.Children.toArray(e),n=t.find((e=>o.isValidElement(e)&&"mdxAdmonitionTitle"===e.props?.mdxType)),a=o.createElement(o.Fragment,null,t.filter((e=>e!==n)));return{mdxAdmonitionTitle:n,rest:a}}(e.children);return{...e,title:e.title??t,children:n}}const le={head:function(e){const t=o.Children.map(e.children,(e=>o.isValidElement(e)?function(e){if(e.props?.mdxType&&e.props.originalType){const{mdxType:t,originalType:n,...a}=e.props;return o.createElement(e.props.originalType,a)}return e}(e):e));return o.createElement(r.Z,e,t)},code:function(e){const t=["a","abbr","b","br","button","cite","code","del","dfn","em","i","img","input","ins","kbd","label","object","output","q","ruby","s","small","span","strong","sub","sup","time","u","var","wbr"];return o.Children.toArray(e.children).every((e=>"string"==typeof e&&!e.includes("\n")||(0,o.isValidElement)(e)&&t.includes(e.props?.mdxType)))?o.createElement("code",e):o.createElement(M,e)},a:function(e){return o.createElement(z.default,e)},pre:function(e){return o.createElement(M,(0,o.isValidElement)(e.children)&&"code"===e.children.props?.originalType?e.children.props:{...e})},details:function(e){const t=o.Children.toArray(e.children),n=t.find((e=>o.isValidElement(e)&&"summary"===e.props?.mdxType)),r=o.createElement(o.Fragment,null,t.filter((e=>e!==n)));return o.createElement(G,(0,a.Z)({},e,{summary:n}),r)},ul:function(e){return o.createElement("ul",(0,a.Z)({},e,{className:X(e.className)}))},img:function(e){return o.createElement("img",(0,a.Z)({loading:"lazy"},e,{className:(t=e.className,(0,c.Z)(t,J.img))}));var t},h1:e=>o.createElement(Q,(0,a.Z)({as:"h1"},e)),h2:e=>o.createElement(Q,(0,a.Z)({as:"h2"},e)),h3:e=>o.createElement(Q,(0,a.Z)({as:"h3"},e)),h4:e=>o.createElement(Q,(0,a.Z)({as:"h4"},e)),h5:e=>o.createElement(Q,(0,a.Z)({as:"h5"},e)),h6:e=>o.createElement(Q,(0,a.Z)({as:"h6"},e)),admonition:function(e){const{children:t,type:n,title:a,icon:r}=re(e),l=function(e){const t=oe[e]??e,n=ae[t];return n||(console.warn(`No admonition config found for admonition type "${t}". Using Info as fallback.`),ae.info)}(n),i=a??l.label,{iconComponent:u}=l,m=r??o.createElement(u,null);return o.createElement("div",{className:(0,c.Z)(s.k.common.admonition,s.k.common.admonitionType(e.type),"alert",`alert--${l.infimaClassName}`,K)},o.createElement("div",{className:ee},o.createElement("span",{className:te},m),i),o.createElement("div",{className:ne},t))},mermaid:()=>null}},5042:(e,t,n)=>{"use strict";n.r(t),n.d(t,{default:()=>l});var a=n(7294),o=n(3905),r=n(1361);function l(e){let{children:t}=e;return a.createElement(o.Zo,{components:r.default},t)}},9407:(e,t,n)=>{"use strict";n.r(t),n.d(t,{default:()=>u});var a=n(7462),o=n(7294),r=n(6010),l=n(8011);const c={tableOfContents:"tableOfContents_bqdL",docItemContainer:"docItemContainer_F8PC"},i="table-of-contents__link toc-highlight",s="table-of-contents__link--active";function u(e){let{className:t,...n}=e;return o.createElement("div",{className:(0,r.Z)(c.tableOfContents,"thin-scrollbar",t)},o.createElement(l.Z,(0,a.Z)({},n,{linkClassName:i,linkActiveClassName:s})))}},9286:(e,t,n)=>{"use strict";n.r(t),n.d(t,{default:()=>d});var a=n(7294),o=n(6010),r=n(6043),l=n(8011),c=n(7462),i=n(5999);const s={tocCollapsibleButton:"tocCollapsibleButton_TO0P",tocCollapsibleButtonExpanded:"tocCollapsibleButtonExpanded_MG3E"};function u(e){let{collapsed:t,...n}=e;return a.createElement("button",(0,c.Z)({type:"button"},n,{className:(0,o.Z)("clean-btn",s.tocCollapsibleButton,!t&&s.tocCollapsibleButtonExpanded,n.className)}),a.createElement(i.Z,{id:"theme.TOCCollapsible.toggleButtonLabel",description:"The label used by the button on the collapsible TOC component"},"On this page"))}const m={tocCollapsible:"tocCollapsible_ETCw",tocCollapsibleContent:"tocCollapsibleContent_vkbj",tocCollapsibleExpanded:"tocCollapsibleExpanded_sAul"};function d(e){let{toc:t,className:n,minHeadingLevel:c,maxHeadingLevel:i}=e;const{collapsed:s,toggleCollapsed:d}=(0,r.u)({initialState:!0});return a.createElement("div",{className:(0,o.Z)(m.tocCollapsible,!s&&m.tocCollapsibleExpanded,n)},a.createElement(u,{collapsed:s,onClick:d}),a.createElement(r.z,{lazy:!0,className:m.tocCollapsibleContent,collapsed:s},a.createElement(l.Z,{toc:t,minHeadingLevel:c,maxHeadingLevel:i})))}},8011:(e,t,n)=>{"use strict";n.d(t,{Z:()=>u});var a=n(7462),o=n(7294),r=n(6668),l=n(9665),c=n(6841);function i(e){let{toc:t,className:n,linkClassName:a,isChild:r}=e;return t.length?o.createElement("ul",{className:r?void 0:n},t.map((e=>o.createElement("li",{key:e.id},o.createElement("a",{href:`#${e.id}`,className:a??void 0,dangerouslySetInnerHTML:{__html:e.value}}),o.createElement(i,{isChild:!0,toc:e.children,className:n,linkClassName:a}))))):null}const s=o.memo(i);function u(e){let{toc:t,className:n="table-of-contents table-of-contents__left-border",linkClassName:i="table-of-contents__link",linkActiveClassName:u,minHeadingLevel:m,maxHeadingLevel:d,...p}=e;const f=(0,r.L)(),h=m??f.tableOfContents.minHeadingLevel,b=d??f.tableOfContents.maxHeadingLevel,g=(0,l.b)({toc:t,minHeadingLevel:h,maxHeadingLevel:b}),v=(0,o.useMemo)((()=>{if(i&&u)return{linkClassName:i,linkActiveClassName:u,minHeadingLevel:h,maxHeadingLevel:b}}),[i,u,h,b]);return(0,c.S)(v),o.createElement(s,(0,a.Z)({toc:g,className:n,linkClassName:i},p))}},5130:(e,t,n)=>{"use strict";n.d(t,{b:()=>l,k:()=>c});var a=n(7294),o=n(902);const r=a.createContext(null);function l(e){let{children:t,content:n}=e;const o=function(e){return(0,a.useMemo)((()=>({metadata:e.metadata,frontMatter:e.frontMatter,assets:e.assets,contentTitle:e.contentTitle,toc:e.toc})),[e])}(n);return a.createElement(r.Provider,{value:o},t)}function c(){const e=(0,a.useContext)(r);if(null===e)throw new o.i6("DocProvider");return e}},5448:(e,t,n)=>{"use strict";n.d(t,{F:()=>c});var a=n(7294),o=n(902);const r={attributes:!0,characterData:!0,childList:!0,subtree:!0};function l(e,t){const[n,l]=(0,a.useState)(),c=(0,a.useCallback)((()=>{l(e.current?.closest("[role=tabpanel][hidden]"))}),[e,l]);(0,a.useEffect)((()=>{c()}),[c]),function(e,t,n){void 0===n&&(n=r);const l=(0,o.zX)(t),c=(0,o.Ql)(n);(0,a.useEffect)((()=>{const t=new MutationObserver(l);return e&&t.observe(e,c),()=>t.disconnect()}),[e,l,c])}(n,(e=>{e.forEach((e=>{"attributes"===e.type&&"hidden"===e.attributeName&&(t(),c())}))}),{attributes:!0,characterData:!1,childList:!1,subtree:!1})}function c(){const[e,t]=(0,a.useState)(!1),[n,o]=(0,a.useState)(!1),r=(0,a.useRef)(null),c=(0,a.useCallback)((()=>{const n=r.current.querySelector("code");e?n.removeAttribute("style"):(n.style.whiteSpace="pre-wrap",n.style.overflowWrap="anywhere"),t((e=>!e))}),[r,e]),i=(0,a.useCallback)((()=>{const{scrollWidth:e,clientWidth:t}=r.current,n=e>t||r.current.querySelector("code").hasAttribute("style");o(n)}),[r]);return l(r,i),(0,a.useEffect)((()=>{i()}),[e,i]),(0,a.useEffect)((()=>(window.addEventListener("resize",i,{passive:!0}),()=>{window.removeEventListener("resize",i)})),[i]),{codeBlockRef:r,isEnabled:e,isCodeScrollable:n,toggle:c}}},6412:(e,t,n)=>{"use strict";n.d(t,{p:()=>r});var a=n(2949),o=n(6668);function r(){const{prism:e}=(0,o.L)(),{colorMode:t}=(0,a.I)(),n=e.theme,r=e.darkTheme||n;return"dark"===t?r:n}},6841:(e,t,n)=>{"use strict";n.d(t,{S:()=>i});var a=n(7294),o=n(6668);function r(e){const t=e.getBoundingClientRect();return t.top===t.bottom?r(e.parentNode):t}function l(e,t){let{anchorTopOffset:n}=t;const a=e.find((e=>r(e).top>=n));if(a){return function(e){return e.top>0&&e.bottom<window.innerHeight/2}(r(a))?a:e[e.indexOf(a)-1]??null}return e[e.length-1]??null}function c(){const e=(0,a.useRef)(0),{navbar:{hideOnScroll:t}}=(0,o.L)();return(0,a.useEffect)((()=>{e.current=t?0:document.querySelector(".navbar").clientHeight}),[t]),e}function i(e){const t=(0,a.useRef)(void 0),n=c();(0,a.useEffect)((()=>{if(!e)return()=>{};const{linkClassName:a,linkActiveClassName:o,minHeadingLevel:r,maxHeadingLevel:c}=e;function i(){const e=function(e){return Array.from(document.getElementsByClassName(e))}(a),i=function(e){let{minHeadingLevel:t,maxHeadingLevel:n}=e;const a=[];for(let o=t;o<=n;o+=1)a.push(`h${o}.anchor`);return Array.from(document.querySelectorAll(a.join()))}({minHeadingLevel:r,maxHeadingLevel:c}),s=l(i,{anchorTopOffset:n.current}),u=e.find((e=>s&&s.id===function(e){return decodeURIComponent(e.href.substring(e.href.indexOf("#")+1))}(e)));e.forEach((e=>{!function(e,n){n?(t.current&&t.current!==e&&t.current.classList.remove(o),e.classList.add(o),t.current=e):e.classList.remove(o)}(e,e===u)}))}return document.addEventListener("scroll",i),document.addEventListener("resize",i),i(),()=>{document.removeEventListener("scroll",i),document.removeEventListener("resize",i)}}),[e,n])}},7016:(e,t,n)=>{"use strict";n.d(t,{QC:()=>p,Vo:()=>m,bc:()=>s,nZ:()=>d,nt:()=>u});var a=n(7594),o=n.n(a);const r=/title=(?<quote>["'])(?<title>.*?)\1/,l=/\{(?<range>[\d,-]+)\}/,c={js:{start:"\\/\\/",end:""},jsBlock:{start:"\\/\\*",end:"\\*\\/"},jsx:{start:"\\{\\s*\\/\\*",end:"\\*\\/\\s*\\}"},bash:{start:"#",end:""},html:{start:"\x3c!--",end:"--\x3e"}};function i(e,t){const n=e.map((e=>{const{start:n,end:a}=c[e];return`(?:${n}\\s*(${t.flatMap((e=>[e.line,e.block?.start,e.block?.end].filter(Boolean))).join("|")})\\s*${a})`})).join("|");return new RegExp(`^\\s*(?:${n})\\s*$`)}function s(e){return e?.match(r)?.groups.title??""}function u(e){return Boolean(e?.includes("showLineNumbers"))}function m(e){const t=e.split(" ").find((e=>e.startsWith("language-")));return t?.replace(/language-/,"")}function d(e,t){let n=e.replace(/\n$/,"");const{language:a,magicComments:r,metastring:s}=t;if(s&&l.test(s)){const e=s.match(l).groups.range;if(0===r.length)throw new Error(`A highlight range has been given in code block's metastring (\`\`\` ${s}), but no magic comment config is available. Docusaurus applies the first magic comment entry's className for metastring ranges.`);const t=r[0].className,a=o()(e).filter((e=>e>0)).map((e=>[e-1,[t]]));return{lineClassNames:Object.fromEntries(a),code:n}}if(void 0===a)return{lineClassNames:{},code:n};const u=function(e,t){switch(e){case"js":case"javascript":case"ts":case"typescript":return i(["js","jsBlock"],t);case"jsx":case"tsx":return i(["js","jsBlock","jsx"],t);case"html":return i(["js","jsBlock","html"],t);case"python":case"py":case"bash":return i(["bash"],t);case"markdown":case"md":return i(["html","jsx","bash"],t);default:return i(Object.keys(c),t)}}(a,r),m=n.split("\n"),d=Object.fromEntries(r.map((e=>[e.className,{start:0,range:""}]))),p=Object.fromEntries(r.filter((e=>e.line)).map((e=>{let{className:t,line:n}=e;return[n,t]}))),f=Object.fromEntries(r.filter((e=>e.block)).map((e=>{let{className:t,block:n}=e;return[n.start,t]}))),h=Object.fromEntries(r.filter((e=>e.block)).map((e=>{let{className:t,block:n}=e;return[n.end,t]})));for(let o=0;o<m.length;){const e=m[o].match(u);if(!e){o+=1;continue}const t=e.slice(1).find((e=>void 0!==e));p[t]?d[p[t]].range+=`${o},`:f[t]?d[f[t]].start=o:h[t]&&(d[h[t]].range+=`${d[h[t]].start}-${o-1},`),m.splice(o,1)}n=m.join("\n");const b={};return Object.entries(d).forEach((e=>{let[t,{range:n}]=e;o()(n).forEach((e=>{b[e]??=[],b[e].push(t)}))})),{lineClassNames:b,code:n}}function p(e){const t={color:"--prism-color",backgroundColor:"--prism-background-color"},n={};return Object.entries(e.plain).forEach((e=>{let[a,o]=e;const r=t[a];r&&"string"==typeof o&&(n[r]=o)})),n}},9665:(e,t,n)=>{"use strict";n.d(t,{a:()=>r,b:()=>c});var a=n(7294);function o(e){const t=e.map((e=>({...e,parentIndex:-1,children:[]}))),n=Array(7).fill(-1);t.forEach(((e,t)=>{const a=n.slice(2,e.level);e.parentIndex=Math.max(...a),n[e.level]=t}));const a=[];return t.forEach((e=>{const{parentIndex:n,...o}=e;n>=0?t[n].children.push(o):a.push(o)})),a}function r(e){return(0,a.useMemo)((()=>o(e)),[e])}function l(e){let{toc:t,minHeadingLevel:n,maxHeadingLevel:a}=e;return t.flatMap((e=>{const t=l({toc:e.children,minHeadingLevel:n,maxHeadingLevel:a});return function(e){return e.level>=n&&e.level<=a}(e)?[{...e,children:t}]:t}))}function c(e){let{toc:t,minHeadingLevel:n,maxHeadingLevel:r}=e;return(0,a.useMemo)((()=>l({toc:o(t),minHeadingLevel:n,maxHeadingLevel:r})),[t,n,r])}},7594:(e,t)=>{function n(e){let t,n=[];for(let a of e.split(",").map((e=>e.trim())))if(/^-?\d+$/.test(a))n.push(parseInt(a,10));else if(t=a.match(/^(-?\d+)(-|\.\.\.?|\u2025|\u2026|\u22EF)(-?\d+)$/)){let[e,a,o,r]=t;if(a&&r){a=parseInt(a),r=parseInt(r);const e=a<r?1:-1;"-"!==o&&".."!==o&&"\u2025"!==o||(r+=e);for(let t=a;t!==r;t+=e)n.push(t)}}return n}t.default=n,e.exports=n}}]);