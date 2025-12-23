// main.ts
const CHARACTER_URL = "https://spritehub-c3a33-default-rtdb.firebaseio.com/characters/dukeNukem.json";
const GRAYLOG_ENDPOINT = "http://graylog-server.thirsty.store:12201/gelf";  // stays optional, errors are swallowed

async function fetchCharacter() {
  try {
    const res = await fetch(CHARACTER_URL);
    if (!res.ok) {
      throw new Error(`fetch failed with status ${res.status}`);
    }
    const data = await res.json();
    return { data };
  } catch (err) {
    console.error("Fetch error:", err);
    return { error: err };
  }
}

async function logToGraylog(data: unknown) {
  try {
    const gelfMessage = {
      version: "1.1",
      host: "deno-app",
      short_message: `Fetched data from ${CHARACTER_URL}`,
      full_message: JSON.stringify(data),
      timestamp: Date.now() / 1000,
      _source: "fetchHandler"
    };
    await fetch(GRAYLOG_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gelfMessage)
    });
  } catch (logErr) {
    // Logging failures should not break the request pipeline on Deploy
    console.error("Graylog logging failed:", logErr);
  }
}

// Use the built-in server helper (Deploy friendly; no explicit port binding)
Deno.serve(async (req) => {
  const { pathname } = new URL(req.url);
  if (pathname !== "/") {
    return new Response("Not Found", { status: 404 });
  }

  const { data, error } = await fetchCharacter();
  if (error) {
    return new Response("Error fetching data", { status: 500 });
  }

  // Fire-and-forget logging; no await needed for response
  logToGraylog(data);

  const jsonText = JSON.stringify(data, null, 2);
  const safeJsonText = jsonText.replace(/<\/script>/g, "<\\/script>");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Deno Fetch Demo</title>
</head>
<body>
  <h1>Deno Fetch Demo</h1>
  <p>Fetched JSON data from Firebase Realtime DB:</p>
  <pre id="data">${safeJsonText}</pre>
  <script>
    const fetchedData = JSON.parse(document.getElementById('data').textContent);
    console.log("Fetched JSON data:", fetchedData);
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" }
  });
});
