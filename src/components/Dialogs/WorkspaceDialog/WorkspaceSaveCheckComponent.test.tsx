import {act, render, screen} from "@testing-library/react";

import {WorkspaceItemKind} from "enums";

import {WorkspaceSaveCheckComponent} from "./WorkspaceSaveCheckComponent";

/** Renders the component, and waits for the icons of Blueprint, which load their images later. */
async function renderCheck(element: React.ReactElement) {
    let result!: ReturnType<typeof render>;
    await act(async () => {
        result = render(element);
    });
    return result;
}

describe("WorkspaceSaveCheckComponent", () => {
    const issues = [
        {kind: WorkspaceItemKind.GeneratedImage, subject: "the PV image of cube.fits", message: "Could not save the PV image of cube.fits: the region it was made over has been deleted", hint: "Draw the region again"},
        {kind: WorkspaceItemKind.Catalog, subject: "a.vot", message: "Could not save the catalog a.vot: it is not one this session opened"}
    ];

    test("lists each item that a save would leave out, with what the user can do", async () => {
        await renderCheck(<WorkspaceSaveCheckComponent issues={issues} />);

        expect(screen.getByText("Will not be saved (2)")).toBeInTheDocument();
        expect(screen.getAllByTestId("workspace-save-issue").map(item => item.textContent)).toEqual([issues[0].message + issues[0].hint, issues[1].message]);
    });

    test("shows only why the session cannot be saved now", async () => {
        await renderCheck(<WorkspaceSaveCheckComponent issues={issues} blocker="Cannot save workspace while a file is still loading." />);

        expect(screen.getByTestId("workspace-save-blocker")).toHaveTextContent("Cannot save workspace while a file is still loading.");
        expect(screen.queryByTestId("workspace-save-issue")).toBeNull();
    });

    test("shows nothing when the save keeps everything", async () => {
        const {container} = await renderCheck(<WorkspaceSaveCheckComponent issues={[]} />);

        expect(container).toBeEmptyDOMElement();
    });
});
