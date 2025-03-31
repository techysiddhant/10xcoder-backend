import { createRouter } from "@/lib/create-app";
import * as handlers from "./categories.handlers";
import * as routes from "./categories.routes";
const router = createRouter().openapi(routes.getAll, handlers.getAll);

export default router;
