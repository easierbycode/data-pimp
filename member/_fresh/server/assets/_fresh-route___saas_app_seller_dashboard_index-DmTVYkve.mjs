import { d as define, a, u, b as SellerDashboard, l, H as Head } from "../server-entry.mjs";
import { P as PageHeader } from "./PageHeader-BB8EE7sm.mjs";
const $$_tpl_1 = ["", "", "<div ", ">", "</div>"];
const index = define.page(function SellerDashboardPage() {
  return a($$_tpl_1, u(Head, {
    children: u("title", {
      children: "Seller Dashboard · LifePreneur"
    })
  }), u(PageHeader, {
    title: "Seller Live Dashboard",
    subtitle: "Per-session GMV, traffic mix, performance trends, and the full Product List — sampled by the Live bookmarklet."
  }), l("style", {
    paddingTop: "1rem",
    paddingBottom: "1.5rem"
  }), u(SellerDashboard, null));
});
const routeCss = null;
const css = routeCss;
const config = void 0;
const handler = void 0;
const handlers = void 0;
const _freshRoute___saas_app_seller_dashboard_index = index;
export {
  config,
  css,
  _freshRoute___saas_app_seller_dashboard_index as default,
  handler,
  handlers
};
