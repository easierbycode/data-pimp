import server, { registerStaticFile } from "./server/server-entry.mjs";

registerStaticFile({"name":"/assets/PageHeader-BhiNc4go.css","hash":"d30fb82b39b7d3421f144ad14089151afa0d478fee66e43b54ae04c56955508d","filePath":"client/assets/PageHeader-BhiNc4go.css","contentType":"text/css; charset=UTF-8","immutable":true});
registerStaticFile({"name":"/assets/Counter-BzMMCu5M.css","hash":"ac12073838bf12e41e4704641f717da9fd875d0394278153c1232be8465b9b44","filePath":"client/assets/Counter-BzMMCu5M.css","contentType":"text/css; charset=UTF-8","immutable":true});
registerStaticFile({"name":"/assets/SellerDashboard-Csa5HYtt.css","hash":"2aa9621daa4b44f38fc30e991e7c54633f96d225eabb99753ff60c2bb64d2679","filePath":"client/assets/SellerDashboard-Csa5HYtt.css","contentType":"text/css; charset=UTF-8","immutable":true});
registerStaticFile({"name":"/assets/StreamerDashboard-D51W5TNU.css","hash":"b9576974b2e76733295a4bca25ad408ea4d91e49ffb74776fffe0979c2ff66d2","filePath":"client/assets/StreamerDashboard-D51W5TNU.css","contentType":"text/css; charset=UTF-8","immutable":true});
registerStaticFile({"name":"/assets/server-entry-B7sbXjey.css","hash":"e917c1a78d147170395dc325273ca0acd25b55a7e0dffb6bfcb9c8c47066f779","filePath":"client/assets/server-entry-B7sbXjey.css","contentType":"text/css; charset=UTF-8","immutable":true});

export default {
  fetch: server.fetch
};
