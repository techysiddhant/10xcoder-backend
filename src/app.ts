import type { Context } from "hono";

import { createRouteHandler } from "uploadthing/server";

import categories from "@/routes/categories/categories.index";
import index from "@/routes/index.route";
import resources from "@/routes/resources/resources.index";
import tags from "@/routes/tags/tags.index";

import { auth } from "./lib/auth";
import configureOpenAPI from "./lib/configure-open-api";
import createApp from "./lib/create-app";
import env from "./lib/env";
import { qstashReceiver } from "./lib/qstash";
import { redisIo } from "./lib/redis";
import { uploadRouter } from "./lib/uploadthing";
import { syncUpvoteCount } from "./lib/utils";
import { isAuth } from "./middlewares/is-auth";
import { upvoteJobBatch } from "./routes/resources/resources.handlers";

const app = createApp();
app.on("POST", "/api/upvote/sync", async (c: Context) => {
  const { logger } = c.var;
  logger.info("Received upvote sync request");

  const signature = c.req.header("upstash-signature");
  if (!signature) {
    console.log("No signature provided");
    return c.json({ error: "No signature" }, 401);
  }
  try {
    // IMPORTANT: Get the raw body text BEFORE parsing it
    const rawBody = await c.req.raw.text();

    // Verify signature with the RAW body text
    const isValid = await qstashReceiver.verify({
      signature,
      body: rawBody,
    });

    logger.info("Signature verification:", isValid);

    if (!isValid) {
      return c.json({ error: "Invalid signature" }, 401);
    }
    await syncUpvoteCount(logger);
    logger.info("Upvote sync complete");
    return c.json(
      {
        success: true,
        message: "Webhook received and verified",
      },
      200,
    );
  }
  catch (error) {
    logger.error("Upvote sync error:", error);
    return c.json({ error: String(error) }, 500);
  }
});
app.on("POST", "/resource/upvote/job/batch", async (c: Context) => {
  const { logger } = c.var;
  logger.info("Received upvote job batch request");

  const signature = c.req.header("upstash-signature");
  if (!signature) {
    console.log("No signature provided");
    return c.json({ error: "No signature" }, 401);
  }
  try {
    // IMPORTANT: Get the raw body text BEFORE parsing it
    const rawBody = await c.req.raw.text();

    // Verify signature with the RAW body text
    const isValid = await qstashReceiver.verify({
      signature,
      body: rawBody,
      url: `${env.APP_URL}/resource/upvote/job/batch`,
    });

    logger.info("Signature verification:", isValid);

    if (!isValid) {
      return c.json({ error: "Invalid signature" }, 401);
    }
    await upvoteJobBatch(c);
    logger.info("Upvote job batch complete");
    return c.json(
      {
        success: true,
        message: "Webhook received and verified",
      },
      200,
    );
  }
  catch (error) {
    logger.error("Upvote job batch error:", error);
    return c.json({ error: String(error) }, 500);
  }
});
configureOpenAPI(app);
const handlers = createRouteHandler({
  router: uploadRouter,
  config: {
    token: env.UPLOADTHING_TOKEN,
  },
});

const routes = [index, resources, categories, tags];
app.all("/api/uploadthing", context => handlers(context.req.raw));
app.on(["POST", "GET"], "/api/auth/*", (c) => {
  if (c.req.path === "/api/auth/use-session") {
    const session = c.get("session");
    const user = c.get("user");
    if (!user)
      return c.body(null, 401);

    return c.json({
      session,
      user,
    });
  }
  return auth.handler(c.req.raw);
});
app.on(["POST"], "/resources", isAuth);
app.on(["PATCH"], "/resource/:id", isAuth);
app.on(["GET"], "/user/resources", isAuth);
app.on(["PATCH"], "/resource/upvote/:id", isAuth);
app.on(["GET", "POST"], "/api/uploadthing", isAuth);
routes.forEach((route) => {
  app.route("/", route);
});
const upvoteEventKey = "upvote-events";
app.get("/stream", (c: Context) => {
  const connectionId = crypto.randomUUID();
  const { logger } = c.var;
  logger.info(`Client ${connectionId} connected to upvote stream`);

  // Create a dedicated Redis subscriber for this connection
  const dedicatedSubscriber = redisIo.duplicate();

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        `data: ${JSON.stringify({ type: "connected", connectionId })}\n\n`,
      );

      const onMessage = (_channel: string, message: string) => {
        try {
          controller.enqueue(`data: ${message}\n\n`);
        }
        catch (err) {
          logger.warn(
            `Stream ${connectionId} closed. Cannot enqueue message.`,
            err,
          );
        }
      };

      // Subscribe to Redis Pub/Sub
      const subscribe = async () => {
        try {
          await dedicatedSubscriber.subscribe(upvoteEventKey);
        }
        catch (err) {
          logger.error(`Redis subscription error for ${connectionId}:`, err);

          // Try to resubscribe after delay
          setTimeout(subscribe, 5000);
        }
      };

      subscribe();

      dedicatedSubscriber.on("message", onMessage);
      let keepAliveTimer: NodeJS.Timeout;
      let keepAliveDelay = 15000; // Start with 15s
      let _consecutiveErrors = 0;
      const sendKeepAlive = () => {
        try {
          controller.enqueue(`: keep-alive ${Date.now()}\n\n`);
          _consecutiveErrors = 0;
          keepAliveDelay = 15000; // Reset to normal interval
        }
        catch (err) {
          _consecutiveErrors++;
          keepAliveDelay = Math.min(keepAliveDelay * 2, 120000); // Max 2 minutes
          logger.warn(
            `Keep-alive failed for ${connectionId}. Increasing delay to ${keepAliveDelay}ms.`,
            err,
          );
        }

        keepAliveTimer = setTimeout(sendKeepAlive, keepAliveDelay);
      };

      keepAliveTimer = setTimeout(sendKeepAlive, keepAliveDelay);

      // Handle client disconnects
      c.req.raw.signal.addEventListener("abort", async () => {
        logger.info(`Client ${connectionId} disconnected from upvote stream`);
        clearTimeout(keepAliveTimer);

        // Cleanup Redis subscription
        dedicatedSubscriber.off("message", onMessage);
        try {
          await dedicatedSubscriber.unsubscribe(upvoteEventKey);
          await dedicatedSubscriber.quit();
        }
        catch (err) {
          logger.error(`Error cleaning up Redis for ${connectionId}:`, err);
        }

        // Skip calling controller.close() as the browser disconnect
        // will automatically close the controller
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
});

export default app;
