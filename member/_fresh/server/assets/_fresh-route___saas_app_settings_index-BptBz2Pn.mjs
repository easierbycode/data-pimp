import { d as define, a, u, c as Settings, l, H as Head } from "../server-entry.mjs";
import { P as PageHeader } from "./PageHeader-BB8EE7sm.mjs";
const $$_tpl_1 = ["", "", "<div ", ">", "</div>"];
const index = define.page(function SettingsPage() {
  return a($$_tpl_1, u(Head, {
    children: u("title", {
      children: "Settings · LifePreneur"
    })
  }), u(PageHeader, {
    title: "Settings",
    subtitle: "Manage your account settings"
  }), l("style", {
    paddingTop: "1.5rem",
    paddingBottom: "1.5rem"
  }), u(Settings, null));
});
const routeCss = null;
const css = routeCss;
const config = void 0;
const handler = void 0;
const handlers = void 0;
const _freshRoute___saas_app_settings_index = index;
export {
  config,
  css,
  _freshRoute___saas_app_settings_index as default,
  handler,
  handlers
};
