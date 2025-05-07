import { Client, Receiver } from "@upstash/qstash";

import env from "./env";

export const qstashClient = new Client({ token: env.QSTASH_TOKEN });
export const qstashReceiver = new Receiver({
  currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
  nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
});
