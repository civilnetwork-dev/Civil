// src/config.ts
self.$meteor_config = {
  prefix: "/met/meteor/",
  codec: self.$meteor_codecs.xor,
  debug: false,
  plugins: [],
  files: {
    client: "/meteor/meteor.client.js",
    worker: "/meteor/meteor.worker.js",
    bundle: "/meteor/meteor.bundle.js",
    codecs: "/meteor/meteor.codecs.js",
    config: "/meteor/meteor.config.js",
  },
};
