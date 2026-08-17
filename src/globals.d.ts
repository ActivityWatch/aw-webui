// We will disable the no-shadow eslint rule for the entire file:
/* eslint-disable no-shadow */

// Constants set at compile time
declare const PRODUCTION: boolean;
declare const AW_SERVER_URL: string;
declare const COMMIT_HASH: string;
// JSON-encoded preset category sets shipped by this build (empty string if none).
// See src/util/presetCategories.ts
declare const AW_PRESET_CATEGORY_SETS: string;
