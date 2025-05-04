import { Redis as RedisUpstash } from "@upstash/redis";
import Redis from "ioredis";
import env from "./env";
export const redis = new RedisUpstash({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

export const redisIo = new Redis(env.REDIS_URL);
// export const redisPublisher = (env: Env["Bindings"]) => {
//   const redisPub = new Redis(env.UPSTASH_REDIS_REST_URL);
//   return redisPub;
// };
export const redisSubscriber = new Redis(env.REDIS_URL);
