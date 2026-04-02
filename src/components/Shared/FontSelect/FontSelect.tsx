import {Button, MenuItem} from "@blueprintjs/core";
import {type ItemRenderer, Select} from "@blueprintjs/select";
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

const AST_FONTS: Font[] = AST.fonts.map((x, i) => new Font(x, i));
// eslint-disable-next-line @typescript-eslint/naming-convention
const FontSelectItem = Select<Font>;

const RenderFont: ItemRenderer<Font> = (font, {handleClick, modifiers, query}) => {
    return <MenuItem active={modifiers.active} disabled={modifiers.disabled} key={font.id} onClick={handleClick} text={<span style={{fontFamily: font.family, fontWeight: font.weight, fontStyle: font.style}}>{font.name}</span>} />;
};

export function fontSelect(isVisible: boolean, currentFontId: number, fontSetter: Function) {
    let currentFont: Font = AST_FONTS[currentFontId];
    if (typeof currentFont === "undefined") {
        currentFont = AST_FONTS[0];
    }

    return (
        <FontSelectItem activeItem={currentFont} itemRenderer={RenderFont} items={AST_FONTS} disabled={!isVisible} filterable={false} popoverProps={{minimal: true, popoverClassName: "fontselect"}} onItemSelect={font => fontSetter(font.id)}>
            <Button text={<span style={{fontFamily: currentFont.family, fontWeight: currentFont.weight, fontStyle: currentFont.style}}>{currentFont.name}</span>} disabled={!isVisible} rightIcon="double-caret-vertical" />
        </FontSelectItem>
    );
}
