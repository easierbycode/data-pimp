import { d as define } from "../server-entry.mjs";
const handler$1 = define.handlers({
  GET() {
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/member/app/dashboard"
      }
    });
  }
});
const routeCss = null;
const css = routeCss;
const config = void 0;
const handler = handler$1;
const handlers = void 0;
const _freshRoute___saas_app_index = void 0;
export {
  config,
  css,
  _freshRoute___saas_app_index as default,
  handler,
  handlers
};
