import { defineConfig } from "wxt";

export default defineConfig({
  zip: {
    excludeSources: ["task_plan.md", "notes.md", "tmp/**"],
  },
  manifest: {
    name: "Dopamine Fast",
    description:
      "Remove suggested content and turn infinite social feeds into intentional batches.",
    permissions: ["storage"],
    browser_specific_settings: {
      gecko: {
        id: "dopamine-fast@arturosdg",
        strict_min_version: "120.0",
        data_collection_permissions: {
          required: ["none"],
        },
      },
    },
  },
});
