// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://3b47c9b0bd92bb69583489e24bb7d5ef@o4508383705628672.ingest.de.sentry.io/4509901283197008",

  // Add optional integrations for additional features
  integrations: [
    Sentry.replayIntegration({
      // NOTE: This will disable built-in masking. Only use this if your site has no sensitive data,
      // or if you've already set up other options for masking or blocking relevant data,
      // such as 'ignore', 'block', 'mask' and 'maskFn'.
      // https://docs.sentry.io/platforms/javascript/session-replay/privacy/#privacy-configuration
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
