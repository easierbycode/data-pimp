// worker.ts

/// <reference no-default-lib="true" />
/// <reference lib="deno.worker" />

self.onmessage = async (event) => {
  const { url } = event.data;
  try {
    // Fetch the JSON data from the external URL
    const res = await fetch(url);
    const data = await res.json();

    // Send a structured log to Graylog in GELF format
    try {
      const gelfMessage = {
        version: "1.1",
        host: "deno-app",  // identifier for the source
        short_message: `Fetched data from ${url}`,
        full_message: JSON.stringify(data),
        timestamp: Date.now() / 1000,  // UNIX timestamp in seconds
        _worker: "fetchWorker"        // custom field (example)
      };
      await fetch("http://graylog-server.thirsty.store:12201/gelf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gelfMessage)
      });
    } catch (logErr) {
      console.error("Graylog logging failed:", logErr);
    }

    // Post the fetched data back to the main thread
    self.postMessage({ data });
  } catch (err) {
    // If fetch fails, send error back
    self.postMessage({ error: err.message });
  } finally {
    // Close the worker after one operation
    self.close();
  }
};