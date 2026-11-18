import {act, fireEvent, render, screen} from "@testing-library/react";
import {observable, runInAction} from "mobx";

import {WorkspaceDialogMode, WorkspaceItemKind} from "enums";

const MOCK_APP_STORE = observable(
    {
        dialogStore: {workspaceDialogMode: WorkspaceDialogMode.Save, hideDialog: jest.fn()},
        apiService: {getWorkspaceList: jest.fn(() => Promise.resolve([]))},
        workspaceSaveBlocker: undefined as string | undefined,
        saveWorkspace: jest.fn(() => Promise.resolve(true)),
        isDarkTheme: false
    },
    {saveWorkspace: false, apiService: false}
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
