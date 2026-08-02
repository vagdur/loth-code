/**
 * The Node-only entry point: everything that needs a filesystem or a
 * subprocess.
 *
 * Kept apart from `./index.js` so that a Cloudflare Worker importing the
 * package cannot reach `fs`, `path`, `js-yaml` or `child_process` even by
 * accident. Importing this module from Worker code is a build error, which is
 * the intent — see `npm run check:worker-safe`.
 */

export {
  camelCaseKeys,
  loadRepository,
  loadYaml,
  readRepoBundle,
} from "./data/repositoryNode.js";
export {
  loadSanctoralRegistry,
  readRegistryBundle,
} from "./calendar/sanctoralRegistryNode.js";
export * from "./tools/htmlAssets.js";
export * from "./tools/compileTex.js";
export * from "./tools/gabcText.js";
