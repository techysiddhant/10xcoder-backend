import { Redis } from "@upstash/redis";
import { Env } from "./types";
export const redis = (env: Env["Bindings"]) => {
  const r = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
  return r;
};
