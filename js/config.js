/*
 * Daybook site configuration.
 * Leave the values empty to run without the Notion sign-in helper.
 * See worker/README.md for how to create the helper and the Notion integration.
 */
window.DAYBOOK_CONFIG = {
  // URL of your deployed Notion helper, for example "https://daybook-helper.yourname.workers.dev"
  helperUrl: "",
  // The OAuth client ID of your Notion public integration (this is not a secret)
  notionClientId: ""
};
