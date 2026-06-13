var has_own_property = Object.prototype.hasOwnProperty;
const noop = () => {
};
function run(fn) {
  return fn();
}
export {
  has_own_property as h,
  noop as n,
  run as r
};
