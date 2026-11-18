import {act, fireEvent, render, screen} from "@testing-library/react";
import {observable, runInAction} from "mobx";

import {WorkspaceDialogMode, WorkspaceItemKind} from "enums";

const MOCK_APP_STORE = observable(
    {
        dialogStore: {workspaceDialogMode: WorkspaceDialogMode.Save, hideDialog: jest.fn()},
        apiService: {getWorkspaceList: jest.fn(() => Promise.resolve([] as {name: string; date: number}[])), getWorkspace: jest.fn(() => Promise.resolve(undefined))},
        alertStore: {showInteractiveAlert: jest.fn((_text: unknown) => Promise.resolve(true))},
        deleteWorkspaces: jest.fn((_names: string[]) => Promise.resolve()),
        loadWorkspace: jest.fn(() => Promise.resolve(true)),
        workspaceSaveBlocker: undefined as string | undefined,
        saveWorkspace: jest.fn(() => Promise.resolve(true)),
        isDarkTheme: false
    },
    {saveWorkspace: false, apiService: false, alertStore: false, deleteWorkspaces: false, loadWorkspace: false}
);
const MockFindIssues = jest.fn();

jest.mock("stores", () => ({
    AppStore: {Instance: MOCK_APP_STORE},
    MirrorSiteStore: {Instance: {}}
}));
jest.mock("stores/Workspace/WorkspacePreflightStore", () => ({WorkspacePreflightStore: jest.fn()}));
jest.mock("stores/Workspace/WorkspaceSnapshotter", () => ({WorkspaceSnapshotter: jest.fn(() => ({findIssues: MockFindIssues}))}));
// Render the dialog as a plain element, so that the test needs no layout of draggable dialogs.
jest.mock("components/Dialogs", () => ({DraggableDialogComponent: (props: {children: unknown}) => <div>{props.children as never}</div>}));
jest.mock("../../Shared", () => ({AppToaster: {show: jest.fn()}, ErrorToast: jest.fn(), ScrollShadow: (props: {children: unknown}) => <div>{props.children as never}</div>, SuccessToast: jest.fn()}));

import {WorkspaceDialogComponent} from "./WorkspaceDialogComponent";

const ISSUE = {kind: WorkspaceItemKind.Catalog, subject: "a.vot", message: "Could not save the catalog a.vot: it is not one this session opened"};

describe("WorkspaceDialogComponent in the Save mode", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        MockFindIssues.mockReturnValue([ISSUE]);
        runInAction(() => {
            MOCK_APP_STORE.dialogStore.workspaceDialogMode = WorkspaceDialogMode.Save;
            MOCK_APP_STORE.workspaceSaveBlocker = undefined;
        });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    async function renderDialog() {
        render(<WorkspaceDialogComponent />);
        await act(async () => {});
        fireEvent.change(screen.getByPlaceholderText("Enter workspace name"), {target: {value: "new"}});
    }

    const saveButton = () => screen.getByTestId("workspace-save-button");

    test("names how many items the save leaves out, and saves without them", async () => {
        await renderDialog();

        expect(saveButton()).toHaveTextContent("Save without 1 item");
        expect(screen.getByTestId("workspace-save-issue")).toHaveTextContent(ISSUE.message);
        fireEvent.keyDown(screen.getByPlaceholderText("Enter workspace name"), {key: "Enter"});
        expect(MOCK_APP_STORE.saveWorkspace).toHaveBeenCalledWith("new");
        // The save closes the dialog when it ends.
        await act(async () => {});
    });

    test("does not save while the session cannot be saved, and waits for the check after that", async () => {
        runInAction(() => (MOCK_APP_STORE.workspaceSaveBlocker = "Cannot save workspace while a file is still loading."));
        await renderDialog();

        expect(screen.getByTestId("workspace-save-blocker")).toHaveTextContent("Cannot save workspace while a file is still loading.");
        expect(saveButton()).toHaveTextContent("Save");
        expect(saveButton()).toHaveAttribute("aria-disabled", "true");
        fireEvent.keyDown(screen.getByPlaceholderText("Enter workspace name"), {key: "Enter"});
        expect(MOCK_APP_STORE.saveWorkspace).not.toHaveBeenCalled();

        act(() => runInAction(() => (MOCK_APP_STORE.workspaceSaveBlocker = undefined)));
        // The button waits for the list, so that the user sees the list before saving.
        expect(saveButton()).toHaveTextContent("Checking…");
        fireEvent.keyDown(screen.getByPlaceholderText("Enter workspace name"), {key: "Enter"});
        expect(MOCK_APP_STORE.saveWorkspace).not.toHaveBeenCalled();
        act(() => jest.advanceTimersByTime(300));
        expect(saveButton()).toHaveTextContent("Save without 1 item");
    });

    test("stops checking the session when the dialog closes", async () => {
        await renderDialog();
        expect(MockFindIssues).toHaveBeenCalledTimes(1);

        act(() => runInAction(() => (MOCK_APP_STORE.dialogStore.workspaceDialogMode = WorkspaceDialogMode.Hidden)));
        act(() => runInAction(() => (MOCK_APP_STORE.workspaceSaveBlocker = "blocked")));
        act(() => runInAction(() => (MOCK_APP_STORE.workspaceSaveBlocker = undefined)));
        act(() => jest.advanceTimersByTime(1000));

        expect(MockFindIssues).toHaveBeenCalledTimes(1);
    });
});

describe("WorkspaceDialogComponent with several workspaces selected", () => {
    // The list is sorted by date, from the newest: a, b, c.
    const workspaces = [
        {name: "c", date: 1},
        {name: "a", date: 3},
        {name: "b", date: 2}
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        MockFindIssues.mockReturnValue([]);
        MOCK_APP_STORE.apiService.getWorkspaceList.mockImplementation(() => Promise.resolve(workspaces));
        runInAction(() => {
            MOCK_APP_STORE.dialogStore.workspaceDialogMode = WorkspaceDialogMode.Open;
            MOCK_APP_STORE.workspaceSaveBlocker = undefined;
        });
    });

    afterEach(() => {
        MOCK_APP_STORE.apiService.getWorkspaceList.mockImplementation(() => Promise.resolve([]));
    });

    const row = (name: string) => screen.getByText(name).closest("[role=option]")!;
    const selectedRows = () =>
        screen
            .getAllByRole("option")
            .filter(option => option.getAttribute("aria-selected") === "true")
            .map(option => option.textContent?.[0]);

    async function renderDialog() {
        render(<WorkspaceDialogComponent />);
        await act(async () => {});
    }

    test("adds a workspace with Cmd or Ctrl, and deletes the selected workspaces after one confirmation", async () => {
        await renderDialog();
        await act(async () => fireEvent.click(row("a")));
        await act(async () => fireEvent.click(row("c"), {metaKey: true}));

        expect(selectedRows()).toEqual(["a", "c"]);
        expect(screen.getByTestId("workspace-multi-selected")).toHaveTextContent("2 workspaces selected");
        expect(screen.getByPlaceholderText("Enter workspace name")).toHaveValue("");
        expect(screen.getByTestId("workspace-open-button")).toHaveAttribute("aria-disabled", "true");

        await act(async () => fireEvent.click(screen.getByText("Delete")));
        expect(MOCK_APP_STORE.alertStore.showInteractiveAlert).toHaveBeenCalledTimes(1);
        render(<>{MOCK_APP_STORE.alertStore.showInteractiveAlert.mock.calls[0][0] as React.ReactNode}</>);
        expect(screen.getByTestId("workspace-delete-names")).toHaveTextContent("Delete these 2 workspaces? This cannot be undone.ac");
        expect(MOCK_APP_STORE.deleteWorkspaces).toHaveBeenCalledWith(["a", "c"]);
    });

    test("takes a workspace out with Cmd or Ctrl, and selects one workspace again with a plain click", async () => {
        await renderDialog();
        await act(async () => fireEvent.click(row("a")));
        await act(async () => fireEvent.click(row("b"), {ctrlKey: true}));
        await act(async () => fireEvent.click(row("c"), {ctrlKey: true}));
        await act(async () => fireEvent.click(row("b"), {ctrlKey: true}));
        expect(selectedRows()).toEqual(["a", "c"]);

        await act(async () => fireEvent.click(row("b")));
        expect(selectedRows()).toEqual(["b"]);
        expect(screen.queryByTestId("workspace-multi-selected")).toBeNull();
    });

    test("selects the rows from the row clicked last with Shift, and opens none of them with Enter", async () => {
        await renderDialog();
        await act(async () => fireEvent.click(row("c")));
        await act(async () => fireEvent.click(row("a"), {shiftKey: true}));
        expect(selectedRows()).toEqual(["a", "b", "c"]);

        fireEvent.keyDown(screen.getByRole("listbox"), {key: "Enter"});
        fireEvent.doubleClick(row("a"));
        expect(MOCK_APP_STORE.loadWorkspace).not.toHaveBeenCalled();
        expect(screen.getByTestId("workspace-multi-selected")).toHaveTextContent("3 workspaces selected");
    });

    test("selects one workspace again when the user types a name", async () => {
        await renderDialog();
        await act(async () => fireEvent.click(row("a")));
        await act(async () => fireEvent.click(row("b"), {metaKey: true}));
        fireEvent.change(screen.getByPlaceholderText("Enter workspace name"), {target: {value: "b"}});

        expect(selectedRows()).toEqual(["b"]);
    });

    test("lists at most 10 names in the confirmation of a delete", async () => {
        const many = Array.from({length: 12}, (_, index) => ({name: `w${String(index).padStart(2, "0")}`, date: 100 - index}));
        MOCK_APP_STORE.apiService.getWorkspaceList.mockImplementation(() => Promise.resolve(many));
        await renderDialog();
        await act(async () => fireEvent.click(row("w00")));
        await act(async () => fireEvent.click(row("w11"), {shiftKey: true}));
        await act(async () => fireEvent.click(screen.getByText("Delete")));

        render(<>{MOCK_APP_STORE.alertStore.showInteractiveAlert.mock.calls[0][0] as React.ReactNode}</>);
        const items = screen.getByTestId("workspace-delete-names").querySelectorAll("li");
        expect(items).toHaveLength(11);
        expect(items[10]).toHaveTextContent("and 2 more");
        expect(MOCK_APP_STORE.deleteWorkspaces).toHaveBeenCalledWith(many.map(item => item.name));
    });

    test("keeps the name in the Save mode, because the save uses it", async () => {
        runInAction(() => (MOCK_APP_STORE.dialogStore.workspaceDialogMode = WorkspaceDialogMode.Save));
        await renderDialog();
        await act(async () => fireEvent.click(row("a")));
        await act(async () => fireEvent.click(row("b"), {metaKey: true}));

        expect(selectedRows()).toEqual(["a", "b"]);
        expect(screen.getByPlaceholderText("Enter workspace name")).toHaveValue("a");
    });
});
