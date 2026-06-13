import { App, staticFiles } from "fresh";
import { define, type State } from "./utils.ts";

// Served same-origin by data-pimp under /member (see ../main.ts composition).
// basePath makes Fresh prefix routes, static files and asset() URLs with /member.
export const app = new App<State>({ basePath: "/member" });

app.use(staticFiles());

// Stubbed session middleware. The Next.js app uses Better Auth here; replace
// with a Deno-compatible session check (e.g. Better Auth's `node` adapter or a
// JWT cookie verifier) when wiring real auth.
app.use(define.middleware((ctx) => {
  ctx.state.user = {
    id: "stub-user",
    email: "daniel@easierbycode.com",
    name: "Daniel Nguyen",
    initials: "DN",
  };
  return ctx.next();
}));

app.fsRoutes();
