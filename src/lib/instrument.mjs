import * as Sentry from "@sentry/node";
Sentry.init({
    dsn: "https://d42f03df8cc0c949567dcd53627eb909@o4507599063744512.ingest.de.sentry.io/4510328531779664",
    // Setting this option to true will send default PII data to Sentry.
    // For example, automatic IP address collection on events
    sendDefaultPii: true,
  });