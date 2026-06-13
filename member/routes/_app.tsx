import { asset } from "fresh/runtime";
import { define } from "../utils.ts";

export default define.page(function App({ Component }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content="#1a1916" />
        <title>LifePreneur · Member</title>
        <link rel="icon" type="image/svg+xml" href={asset("/logo.svg")} />
      </head>
      <body>
        <Component />
      </body>
    </html>
  );
});
