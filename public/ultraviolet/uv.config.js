self.__uv$config = {
  prefix: "/ult/ultraviolet/",
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  handler: "/ultraviolet/uv.handler.js",
  client: "/ultraviolet/uv.client.js",
  bundle: "/ultraviolet/uv.bundle.js",
  config: "/ultraviolet/uv.config.js",
  sw: "/ultraviolet/uv.sw.js",
};
