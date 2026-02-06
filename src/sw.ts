// TODO clean up this whole thing

// import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
// import { clientsClaim } from 'workbox-core';
// TODO just to import something to make it a module and typescript work
import type {} from "workbox-core";

// @ts-expect-error missing
importScripts(
  "https://storage.googleapis.com/workbox-cdn/releases/6.1.1/workbox-sw.js",
);

// Note: Ignore the error that Glitch raises about workbox being undefined.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare let workbox: any;
workbox.setConfig({
  debug: true,
});
// To avoid async issues, we load strategies before we call it in the event listener
workbox.loadModule("workbox-core");
// workbox.loadModule('workbox-routing');
workbox.loadModule("workbox-precaching");
// workbox.loadModule('workbox-cacheable-response');
// workbox.loadModule('workbox-strategies');
// workbox.loadModule('workbox-expiration');

// @ts-expect-error missing
declare let self: ServiceWorkerGlobalScope;

workbox.precaching.cleanupOutdatedCaches();
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
workbox.precaching.precacheAndRoute(self.__WB_MANIFEST);

self.skipWaiting();
workbox.core.clientsClaim();

// @ts-expect-error missing
self.addEventListener("push", function (event) {
  if (!event.data) {
    console.log("This push event has no data.");
    return;
  }
  if (!self.registration) {
    console.log("Service worker does not control the page");
    return;
  }
  if (!self.registration || !self.registration.pushManager) {
    console.log("Push is not supported");
    return;
  }

  const eventText = event.data.text();
  // Specify default options
  let options = {};
  let title = "";

  // Support both plain text notification and json
  if (eventText.substr(0, 1) === "{") {
    const eventData = JSON.parse(eventText);
    title = eventData.title;

    // Set specific options
    // @link https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification#parameters
    if (eventData.options) {
      options = Object.assign(options, eventData.options);
    }

    // Check expiration if specified
    if (eventData.expires && Date.now() > eventData.expires) {
      console.log("Push notification has expired");
      return;
    }
  } else {
    title = eventText;
  }

  // Warning: this can fail silently if notifications are disabled at system level
  // The promise itself resolve to undefined and is not helpful to see if it has been displayed properly
  const promiseChain = self.registration.showNotification(title, options);

  // With this, the browser will keep the service worker running until the promise you passed in has settled.
  event.waitUntil(promiseChain);
});
