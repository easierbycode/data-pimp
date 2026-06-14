import { d as define, a, u, C as CommunityHub, l, H as Head } from "../server-entry.mjs";
import { P as PageHeader } from "./PageHeader-BB8EE7sm.mjs";
const $$_tpl_1 = ["", "", "<div ", ">", "</div>"];
const index = define.page(function CommunityPage() {
  return a($$_tpl_1, u(Head, {
    children: u("title", {
      children: "Community · LifePreneur"
    })
  }), u(PageHeader, {
    title: "Community Hub",
    subtitle: "Connect with platforms and stay updated with announcements"
  }), l("style", {
    paddingTop: "1rem",
    paddingBottom: "1.5rem"
  }), u(CommunityHub, null));
});
const routeCss = null;
const css = routeCss;
const config = void 0;
const handler = void 0;
const handlers = void 0;
const _freshRoute___saas_app_community_index = index;
export {
  config,
  css,
  _freshRoute___saas_app_community_index as default,
  handler,
  handlers
};
