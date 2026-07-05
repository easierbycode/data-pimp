const node_env = globalThis.process?.env?.NODE_ENV;
const DEV = node_env && !node_env.toLowerCase().startsWith("prod");
var has_own_property = Object.prototype.hasOwnProperty;
const noop = () => {
};
function run(fn) {
  return fn();
}
typeof process === "object" && process.versions?.node !== void 0;
export {
  DEV as D,
  has_own_property as h,
  noop as n,
  run as r
};
