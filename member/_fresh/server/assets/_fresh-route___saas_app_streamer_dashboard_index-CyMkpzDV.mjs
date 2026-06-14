import { d as define, a, u, e as StreamerDashboard, l, H as Head } from "../server-entry.mjs";
import { P as PageHeader } from "./PageHeader-BB8EE7sm.mjs";
const $$_tpl_1 = ["", "", "<div ", ">", "</div>"];
const index = define.page(function StreamerDashboardPage() {
  return a($$_tpl_1, u(Head, {
    children: u("title", {
      children: "Streamer Compass · LifePreneur"
    })
  }), u(PageHeader, {
    title: "Streamer Compass",
    subtitle: "The seller's own video performance — KPI tiles, per-video metrics, and trend deltas. Sampled by the Streamer bookmarklet."
  }), l("style", {
    paddingTop: "1rem",
    paddingBottom: "1.5rem"
  }), u(StreamerDashboard, null));
});
const routeCss = null;
const css = routeCss;
const config = void 0;
const handler = void 0;
const handlers = void 0;
const _freshRoute___saas_app_streamer_dashboard_index = index;
export {
  config,
  css,
  _freshRoute___saas_app_streamer_dashboard_index as default,
  handler,
  handlers
};
