import { d as define, a, u, M as MemberDashboardV2, H as Head } from "../server-entry.mjs";
const $$_tpl_1 = ["", "", ""];
const index = define.page(function DashboardPage() {
  return a($$_tpl_1, u(Head, {
    children: u("title", {
      children: "Dashboard · LifePreneur"
    })
  }), u(MemberDashboardV2, null));
});
const routeCss = null;
const css = routeCss;
const config = void 0;
const handler = void 0;
const handlers = void 0;
const _freshRoute___saas_app_dashboard_index = index;
export {
  config,
  css,
  _freshRoute___saas_app_dashboard_index as default,
  handler,
  handlers
};
