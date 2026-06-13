import { a, s } from "../server-entry.mjs";
const $$_tpl_1 = ['<div class="lp-page-header"><h2 class="lp-page-header__title">', "</h2>", "</div>"];
const $$_tpl_2 = ['<p class="lp-page-header__subtitle">', "</p>"];
function PageHeader({
  title,
  subtitle
}) {
  return a($$_tpl_1, s(title), s(subtitle && a($$_tpl_2, s(subtitle))));
}
export {
  PageHeader as P
};
