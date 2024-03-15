const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const main = require("./addon");

const manifest = {
  id: "community.bennissy-letterboxd",
  version: "1.0.2",
  logo: "https://cdn.glitch.global/6d31ecc7-3b41-4db9-aa84-3e9c332690a1/letterboxd.webp?v=1707940648543",
  catalogs: [
   
    {
      type: "movie",
      id: "new",
      name: "Letterboxd - New"
    }
  ],
  resources: ["catalog"],
  types: ["movie"],
  name: "Letterboxd",
  description: "Letterboxd Lists",
};

const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(async (args) => {
  if (args.type !== "movie" || (args.id !== "top" && args.id !== 'popular' && args.id !== 'new') || args.extra.search) {
    return Promise.resolve({ metas: [] });
  }

  const metas = await main(args.id);

  return Promise.resolve({ metas });
});

serveHTTP(builder.getInterface(), { port: 3000 });
