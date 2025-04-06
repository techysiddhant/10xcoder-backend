import { Redis as RedisUpstash } from "@upstash/redis";
import { Env } from "./types";
import Redis from "ioredis";
export const redis = (env: Env["Bindings"]) => {
  const r = new RedisUpstash({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
  return r;
};

export const redisPublisher = (env: Env["Bindings"]) => {
  const redisPub = new Redis(env.UPSTASH_REDIS_REST_URL);
  return redisPub;
};
export const redisSubscriber = (env: Env["Bindings"]) => {
  const redisSub = new Redis(env.UPSTASH_REDIS_REST_URL);
  return redisSub;
};
