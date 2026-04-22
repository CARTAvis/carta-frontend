import * as React from "react";
import {Button, Callout, Classes, Dialog, type DialogProps, FormGroup, H5, HTMLTable, Intent, Spinner} from "@blueprintjs/core";
import classNames from "classnames";
import {action, makeObservable, observable, runInAction} from "mobx";
import {observer} from "mobx-react";

import {DraggableDialogComponent} from "components/Dialogs";
import {AppToaster, ErrorToast, SuccessToast} from "components/Shared";
import {DialogId} from "enums";
import {type ApiKeyEntry} from "services";
import {AppStore} from "stores";
import {copyToClipboard} from "utilities";

import "./ApiKeyDialogComponent.scss";

@observer
export class ApiKeyDialogComponent extends React.Component {
    private static readonly DefaultWidth = 700;
    private static readonly DefaultHeight = 470;
    private static readonly MinWidth = 460;
    private static readonly MinHeight = 360;

    @observable tokenExpirySecondsInput: string = "";
    @observable isLoading: boolean = false;
    @observable isCreating: boolean = false;
    @observable deletingKeyId: string = "";
    @observable keys: ApiKeyEntry[] = [];
    @observable latestCreatedKey: {keyId: string; accessKey: string; expiry: string} | undefined = undefined;
    @observable credentialsDialogOpen: boolean = false;
    private wasOpen = false;

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    componentDidUpdate() {
        const isOpen = AppStore.Instance.dialogStore.dialogVisible.get(DialogId.ApiKey) ?? false;
        if (isOpen && !this.wasOpen) {
            this.loadKeys();
        }
        this.wasOpen = isOpen;
    }

    @action private onTokenExpirySecondsChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
        this.tokenExpirySecondsInput = event.target.value;
    };

    private loadKeys = async () => {
        runInAction(() => {
            this.isLoading = true;
        });

        const apiKeys = await AppStore.Instance.apiService.getApiKeys();
        if (!apiKeys) {
            AppToaster.show(ErrorToast("Failed to load API keys."));
        }

        runInAction(() => {
            this.keys = apiKeys ?? [];
            this.isLoading = false;
        });
    };

    private onCreateClicked = async () => {
        if (this.isCreating) {
            return;
        }

        runInAction(() => {
            this.isCreating = true;
        });

        const appStore = AppStore.Instance;
        const trimmedValue = this.tokenExpirySecondsInput.trim();
        let tokenExpirySeconds: number | undefined = undefined;
        if (trimmedValue) {
            const parsed = Number(trimmedValue);
            if (!Number.isInteger(parsed) || parsed <= 0) {
                AppToaster.show(ErrorToast("Token expiry period must be a positive integer number of seconds."));
                runInAction(() => {
                    this.isCreating = false;
                });
                return;
            }
            tokenExpirySeconds = parsed;
        }

        const response = await appStore.apiService.createApiKey(tokenExpirySeconds);

        if (!response) {
            AppToaster.show(ErrorToast("Failed to create API key. Server did not return key_id, access_key and expiry."));
            runInAction(() => {
                this.isCreating = false;
            });
            return;
        }

        runInAction(() => {
            this.keys = [...this.keys.filter(entry => entry.key_id !== response.key_id), {key_id: response.key_id, expiry: response.expiry}];
            this.isCreating = false;
            this.latestCreatedKey = {keyId: response.key_id, accessKey: response.access_key, expiry: response.expiry};
            this.credentialsDialogOpen = true;
        });

        AppToaster.show(SuccessToast("key", `API key ${response.key_id} created.`));
    };

    private copyValue = async (label: string, value: string) => {
        try {
            await copyToClipboard(value);
            AppToaster.show(SuccessToast("clipboard", `${label} copied to clipboard.`));
        } catch (err) {
            console.error(err);
            AppToaster.show(ErrorToast(`Failed to copy ${label.toLowerCase()}.`));
        }
    };

    private onDeleteClicked = async (keyId: string) => {
        if (this.deletingKeyId) {
            return;
        }

        runInAction(() => {
            this.deletingKeyId = keyId;
        });

        const success = await AppStore.Instance.apiService.deleteApiKey(keyId);
        if (!success) {
            AppToaster.show(ErrorToast(`Failed to delete API key ${keyId}.`));
            runInAction(() => {
                this.deletingKeyId = "";
            });
            return;
        }

        runInAction(() => {
            this.keys = this.keys.filter(entry => entry.key_id !== keyId);
            this.deletingKeyId = "";
        });
        AppToaster.show(SuccessToast("trash", `Deleted API key ${keyId}.`));
    };

    private onCloseClicked = () => {
        AppStore.Instance.dialogStore.hideDialog(DialogId.ApiKey);
    };

    @action private dismissCredentialsDialog = () => {
        this.credentialsDialogOpen = false;
    };

    public render() {
        const appStore = AppStore.Instance;
        const className = classNames("api-key-dialog", {[Classes.DARK]: appStore.darkTheme});

        const dialogProps: DialogProps = {
            icon: "key",
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: true,
            lazy: true,
            isOpen: appStore.dialogStore.dialogVisible.get(DialogId.ApiKey) ?? false,
            className,
            canEscapeKeyClose: true,
            title: "API Key Management"
        };

        const isListEmpty = this.keys.length === 0;
        const listClassName = classNames("api-key-list", {"api-key-list-disabled": isListEmpty});

        return (
            <DraggableDialogComponent
                dialogProps={dialogProps}
                defaultWidth={ApiKeyDialogComponent.DefaultWidth}
                defaultHeight={ApiKeyDialogComponent.DefaultHeight}
                minWidth={ApiKeyDialogComponent.MinWidth}
                minHeight={ApiKeyDialogComponent.MinHeight}
                enableResizing={false}
                dialogId={DialogId.ApiKey}
            >
                <div className={classNames(Classes.DIALOG_BODY, "api-key-dialog-body")}>
                    <p className="api-key-dialog-description">Manage API keys for scripted access. New keys are shown once and must be copied immediately.</p>

                    <div className="api-key-list-section">
                        <H5>Existing API keys</H5>
                        <div className="api-key-list-scroll">
                            {this.isLoading ? (
                                <div className="api-key-loading">
                                    <Spinner size={24} />
                                </div>
                            ) : (
                                <HTMLTable className={listClassName}>
                                    <thead>
                                        <tr>
                                            <th>Key ID</th>
                                            <th>Expiry date</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {this.keys.map(entry => (
                                            <tr key={entry.key_id}>
                                                <td className="api-key-id-cell">{entry.key_id}</td>
                                                <td className="api-key-expiry-cell">{entry.expiry || "-"}</td>
                                                <td className="api-key-actions-cell">
                                                    <Button
                                                        small={true}
                                                        icon="trash"
                                                        intent={Intent.DANGER}
                                                        disabled={this.deletingKeyId === entry.key_id}
                                                        loading={this.deletingKeyId === entry.key_id}
                                                        onClick={() => this.onDeleteClicked(entry.key_id)}
                                                    >
                                                        Delete
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                        {isListEmpty && (
                                            <tr>
                                                <td colSpan={3}>No API keys found for this user.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </HTMLTable>
                            )}
                        </div>
                    </div>

                    <div className="api-key-create-section">
                        <H5>Create API key</H5>
                        <FormGroup label="Token expiry period (seconds, optional)" labelFor="api-key-expiry-seconds" helperText="Leave blank to let the server choose a default token lifetime.">
                            <input id="api-key-expiry-seconds" className={Classes.INPUT} type="number" min={1} step={1} value={this.tokenExpirySecondsInput} onChange={this.onTokenExpirySecondsChanged} placeholder="e.g. 3600" />
                        </FormGroup>
                    </div>
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <Button intent={Intent.PRIMARY} onClick={this.onCreateClicked} loading={this.isCreating} disabled={this.isCreating}>
                            Create Key
                        </Button>
                        <Button onClick={this.onCloseClicked}>Close</Button>
                    </div>
                </div>

                <Dialog
                    icon="key"
                    isOpen={this.credentialsDialogOpen && !!this.latestCreatedKey}
                    title="New API Key Credentials"
                    canEscapeKeyClose={false}
                    canOutsideClickClose={false}
                    isCloseButtonShown={false}
                    className={classNames("api-key-credentials-dialog", {[Classes.DARK]: appStore.darkTheme})}
                >
                    {this.latestCreatedKey && (
                        <React.Fragment>
                            <div className={Classes.DIALOG_BODY}>
                                <Callout intent={Intent.WARNING}>
                                    Copy and save both the key ID and access key now. Both values are required for successful authentication. The access key is not stored on the server, so if this is lost the key must be recreated.
                                </Callout>
                                <HTMLTable className="api-key-created-table">
                                    <tbody>
                                        <tr>
                                            <th>Key ID</th>
                                            <td className="api-key-secret-value">{this.latestCreatedKey.keyId}</td>
                                        </tr>
                                        <tr>
                                            <th>Access key</th>
                                            <td className="api-key-secret-value">{this.latestCreatedKey.accessKey}</td>
                                        </tr>
                                        <tr>
                                            <th>Expiry date</th>
                                            <td>{this.latestCreatedKey.expiry}</td>
                                        </tr>
                                    </tbody>
                                </HTMLTable>
                                <div className="api-key-credentials-actions">
                                    <Button small={true} icon="clipboard" onClick={() => this.copyValue("Key ID", this.latestCreatedKey?.keyId ?? "")}>
                                        Copy Key ID
                                    </Button>
                                    <Button small={true} icon="clipboard" onClick={() => this.copyValue("Access key", this.latestCreatedKey?.accessKey ?? "")}>
                                        Copy Access Key
                                    </Button>
                                </div>
                            </div>
                            <div className={Classes.DIALOG_FOOTER}>
                                <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                                    <Button intent={Intent.PRIMARY} onClick={this.dismissCredentialsDialog}>
                                        Dismiss
                                    </Button>
                                </div>
                            </div>
                        </React.Fragment>
                    )}
                </Dialog>
            </DraggableDialogComponent>
        );
    }
}
