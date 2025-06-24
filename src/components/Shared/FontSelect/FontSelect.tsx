import {Button, MenuItem} from "@blueprintjs/core";
import {ItemRenderer, Select} from "@blueprintjs/select";
import * as AST from "ast_wrapper";

// Font selector
export class Font {
    name: string;
    id: number;
    style: string;
    weight: number;
    family: string;

    constructor(name: string, id: number) {
        this.name = name.replace("{size} ", "");
        this.id = id;

        let family = this.name;

        if (family.indexOf("bold") === 0) {
            family = family.replace("bold ", "");
            this.weight = 700;
        } else {
            this.weight = 400;
        }

        if (family.indexOf("italic") === 0) {
            family = family.replace("italic ", "");
            this.style = "italic";
        } else {
            this.style = "";
        }

        this.family = family;
    }
}

const astFonts: Font[] = AST.fonts.map((x, i) => new Font(x, i));
const FontSelect = Select<Font>;

const renderFont: ItemRenderer<Font> = (font, {handleClick, modifiers, query}) => {
    return <MenuItem active={modifiers.active} disabled={modifiers.disabled} key={font.id} onClick={handleClick} text={<span style={{fontFamily: font.family, fontWeight: font.weight, fontStyle: font.style}}>{font.name}</span>} />;
};

export function fontSelect(visible: boolean, currentFontId: number, fontSetter: Function) {
    let currentFont: Font = astFonts[currentFontId];
    if (typeof currentFont === "undefined") {
        currentFont = astFonts[0];
    }

    return (
        <FontSelect activeItem={currentFont} itemRenderer={renderFont} items={astFonts} disabled={!visible} filterable={false} popoverProps={{minimal: true, popoverClassName: "fontselect"}} onItemSelect={font => fontSetter(font.id)}>
            <Button text={<span style={{fontFamily: currentFont.family, fontWeight: currentFont.weight, fontStyle: currentFont.style}}>{currentFont.name}</span>} disabled={!visible} rightIcon="double-caret-vertical" />
        </FontSelect>
    );
}
