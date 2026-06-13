const node_env = globalThis.process?.env?.NODE_ENV;
const DEV = node_env && !node_env.toLowerCase().startsWith("prod");
typeof process === "object" && process.versions?.node !== void 0;
export {
  DEV as D
};
