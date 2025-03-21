import { AppOpenAPI } from "./types";
import { apiReference } from "@scalar/hono-api-reference";
import packageJson from "../../package.json";
export default function configureOpenAPI(app: AppOpenAPI) {
  app.doc("/doc", {
    openapi: "3.0.0",
    info: {
      title: "Hono",
      version: packageJson.version,
      description: "Hono API",
    },
  });

  app.get(
    "/reference",
    apiReference({
      theme: "kepler",
      layout: "classic",
      defaultHttpClient: {
        targetKey: "js",
        clientKey: "fetch",
      },
      url: "/doc",
    })
  );
}
