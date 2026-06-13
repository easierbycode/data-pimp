// Import CSS files here for hot module reloading to work.
//
// Plain CSS (not CSS Modules) imported from the client entry is bundled into
// `client-entry.css`, which Fresh always links. We reach for plain CSS for
// any styles used by server-rendered components (layout shell, nav, page
// header) because Fresh's per-route/per-island chunking otherwise sends
// CSS Module rules into `server-entry.css` — a chunk that's never linked
// in rendered HTML. Island and route CSS Modules still work fine on their
// own and stay scoped — only server-only components dropped into globals.
import "./assets/styles.css";
import "./components/Logo.css";
import "./components/UserMenu.css";
import "./components/NavBar.css";
import "./components/MobileHeader.css";
import "./components/BottomNav.css";
import "./components/PageHeader.css";
import "./routes/(saas)/app/_layout.css";
