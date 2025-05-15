import { Redis as RedisUpstash } from "@upstash/redis";
import Redis from "ioredis";

import env from "./env";

export const redis = new RedisUpstash({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

export const redisIo = new Redis(env.REDIS_URL);
redisIo.on("error", (err) => {
  console.error("Redis IO client error:", err);
});

export const redisSubscriber = new Redis(env.REDIS_URL);
redisSubscriber.on("error", (err) => {
  console.error("Redis Subscriber client error:", err);
});

export const CACHE_VERSIONS = {
  BOOKMARKS: "V1",
  SEARCH: "V1",
};
