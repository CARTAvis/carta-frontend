import $ from "jquery";

// $.trim was removed in jQuery 3.5+; GoldenLayout v1.5.9 still uses it
if (!$.trim) {
    $.trim = (str: string) => (str == null ? "" : (str + "").replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, ""));
}

window["$"] = $;
window["jQuery"] = $;
