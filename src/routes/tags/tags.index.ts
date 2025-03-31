import { createRouter } from "@/lib/create-app";
import * as handlers from "./tags.handlers";
import * as routes from "./tags.routes";
const router = createRouter().openapi(routes.getAll, handlers.getAll);

export default router;
