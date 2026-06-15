import { define } from "../../../utils.ts";

// `/member/app` has no standalone home view — send it to the dashboard, the
// same target as the `/member` root redirect (see routes/index.tsx). The logo
// links (NavBar, MobileHeader) point here, so this keeps `/member/app` a valid,
// bookmarkable URL instead of 404ing.
export const handler = define.handlers({
  GET() {
    return new Response(null, {
      status: 302,
      headers: { Location: "/member/app/dashboard" },
    });
  },
});
