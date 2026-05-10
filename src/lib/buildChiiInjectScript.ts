export function buildChiiInjectScript(targetScriptText: string) {
    return `(function(){
  var L = function (m, x) { try { console.log('[civil-chii] ' + m, x === undefined ? '' : x); } catch(_) {} };
  L('wrapper start, location=', location.href);

  var __savedWS = window.WebSocket;
  var __savedFetch = window.fetch;
  var __savedSetImmediate = window.setImmediate;
  var __savedClearImmediate = window.clearImmediate;
  var __nativeWS = null;
  var __nativeFetch = null;
  try {
    var __p = window.parent;
    if (__p && __p !== window) {
      __nativeWS = __p.WebSocket || null;
      __nativeFetch = __p.fetch || null;
      L('preferred parent.WebSocket?', typeof __nativeWS);
      L('preferred parent.fetch?', typeof __nativeFetch);
    } else {
      L('parent === window, no preferred parent globals');
    }
  } catch (eP) {
    L('parent global lookup threw', String(eP));
  }
  __nativeWS = __nativeWS || window.__civilNativeWebSocket || null;
  __nativeFetch = __nativeFetch || window.__civilNativeFetch || null;
  L('preamble nativeWS?', typeof __nativeWS);
  L('preamble nativeFetch?', typeof __nativeFetch);

  if (!__nativeWS) {
    try {
      if (__p && __p !== window) {
        __nativeWS = __p.WebSocket;
        __nativeFetch = __nativeFetch || __p.fetch;
        L('fallback parent.WebSocket?', typeof __nativeWS);
      } else {
        L('parent === window, no fallback');
      }
    } catch (e) { L('parent access threw', String(e)); }
  }

  if (__nativeWS) {
    try {
      var __civilChiiSocketSeq = 0;
      var __CivilWebSocket = function (url, protocols) {
        var facade = new EventTarget();
        var socketId = 'civil-chii-ws-' + (++__civilChiiSocketSeq) + '-' + Math.random().toString(36).slice(2);
        var state = {
          id: socketId,
          url: url,
          protocol: '',
          extensions: '',
          readyState: 0,
          bufferedAmount: 0,
          binaryType: 'blob',
          onopen: null,
          onmessage: null,
          onerror: null,
          onclose: null,
        };
        function cleanup() {
          window.removeEventListener('__civilChiiBridgeToChild', onBridgeMessage);
        }
        function emit(type, event) {
          var handler = state['on' + type];
          if (typeof handler === 'function') {
            try { handler.call(facade, event); }
            catch (err) { setTimeout(function () { throw err; }, 0); }
          }
          if (type === 'close') cleanup();
          facade.dispatchEvent(event);
        }
        function onBridgeMessage(event) {
          var msg = event.detail;
          if (!msg || msg.id !== socketId) {
            return;
          }
          if (msg.type === 'open') {
            state.readyState = 1;
            state.protocol = msg.protocol || '';
            state.extensions = msg.extensions || '';
            emit('open', new Event('open'));
            return;
          }
          if (msg.type === 'error') {
            emit('error', new Event('error'));
            return;
          }
          if (msg.type === 'close') {
            state.readyState = 3;
            emit('close', new CloseEvent('close', {
              code: msg.code,
              reason: msg.reason,
              wasClean: msg.wasClean,
            }));
            return;
          }
          if (msg.type === 'message') {
            var payload = msg.data;
            if (payload && typeof payload !== 'string') {
              if (payload instanceof ArrayBuffer) {
                if (state.binaryType === 'blob') {
                  payload = new Blob([payload]);
                }
              } else if ('arrayBuffer' in payload && state.binaryType === 'arraybuffer') {
                payload = payload.arrayBuffer();
              }
            }
            emit('message', new MessageEvent('message', {
              data: payload,
              origin: msg.origin || '',
              lastEventId: msg.lastEventId || '',
              source: null,
              ports: msg.ports || [],
            }));
          }
        }
        window.addEventListener('__civilChiiBridgeToChild', onBridgeMessage);
        Object.defineProperties(facade, {
          url: { get: function () { return state.url; } },
          protocol: { get: function () { return state.protocol; } },
          extensions: { get: function () { return state.extensions; } },
          readyState: { get: function () { return state.readyState; } },
          bufferedAmount: { get: function () { return state.bufferedAmount; } },
          binaryType: {
            get: function () { return state.binaryType; },
            set: function (value) {
              state.binaryType = value;
              try {
                window.dispatchEvent(new CustomEvent('__civilChiiBridgeToHost', {
                  detail: {
                    type: 'setBinaryType',
                    id: socketId,
                    binaryType: value,
                  },
                }));
              } catch (_) {}
            },
          },
          onopen: {
            get: function () { return state.onopen; },
            set: function (value) { state.onopen = value; },
          },
          onmessage: {
            get: function () { return state.onmessage; },
            set: function (value) { state.onmessage = value; },
          },
          onerror: {
            get: function () { return state.onerror; },
            set: function (value) { state.onerror = value; },
          },
          onclose: {
            get: function () { return state.onclose; },
            set: function (value) { state.onclose = value; },
          },
        });
        facade.send = function (data) {
          window.dispatchEvent(new CustomEvent('__civilChiiBridgeToHost', {
            detail: {
              type: 'send',
              id: socketId,
              data: data,
            },
          }));
        };
        facade.close = function (code, reason) {
          if (state.readyState >= 2) return;
          state.readyState = 2;
          window.dispatchEvent(new CustomEvent('__civilChiiBridgeToHost', {
            detail: {
              type: 'close',
              id: socketId,
              code: code == null ? 1000 : code,
              reason: reason == null ? '' : reason,
            },
          }));
        };
        window.dispatchEvent(new CustomEvent('__civilChiiBridgeToHost', {
          detail: {
            type: 'create',
            id: socketId,
            url: url,
            protocols: protocols == null ? undefined : protocols,
          },
        }));
        return facade;
      };
      __CivilWebSocket.CONNECTING = 0;
      __CivilWebSocket.OPEN = 1;
      __CivilWebSocket.CLOSING = 2;
      __CivilWebSocket.CLOSED = 3;
      Object.defineProperty(window, 'WebSocket', {
        value: __CivilWebSocket, writable: true, configurable: true,
      });
      L('replaced window.WebSocket via defineProperty (bridge)');
    } catch (e1) {
      try { window.WebSocket = __nativeWS; L('replaced window.WebSocket via assignment'); }
      catch (e2) { L('assignment(WebSocket) threw', String(e2)); }
    }
  } else {
    L('NO native WebSocket available, chii will use proxied WS');
  }

  if (__nativeFetch) {
    try {
      Object.defineProperty(window, 'fetch', {
        value: __nativeFetch, writable: true, configurable: true,
      });
      L('replaced window.fetch via defineProperty');
    } catch (e3) {
      try { window.fetch = __nativeFetch; L('replaced window.fetch via assignment'); }
      catch (e4) { L('assignment(fetch) threw', String(e4)); }
    }
  }

  // ScramJet can expose a MessageChannel whose port1 is undefined.
  // If that happens, swap in a minimal working shim for bootstrap so
  // Chii's setImmediate polyfill has a valid channel implementation.
  var __savedMC = window.MessageChannel;
  var __savedMP = window.MessagePort;
  var __useMCShim = false;
  try {
    if (typeof __savedMC !== 'function') {
      __useMCShim = true;
    } else {
      var __probe = new __savedMC();
      __useMCShim = !__probe || !__probe.port1 || !__probe.port2;
      try { __probe.port1 && __probe.port1.close && __probe.port1.close(); } catch (_) {}
      try { __probe.port2 && __probe.port2.close && __probe.port2.close(); } catch (_) {}
    }
  } catch (e5) {
    __useMCShim = true;
    L('MessageChannel probe failed', String(e5));
  }

  function __CivilMessagePort() {}
  function __civilBindPort(port, peer) {
    port.onmessage = null;
    port.start = function () {};
    port.close = function () {
      port.onmessage = null;
    };
    port.addEventListener = function (type, handler) {
      if (type === 'message') port.onmessage = handler;
    };
    port.removeEventListener = function (type, handler) {
      if (type === 'message' && port.onmessage === handler) port.onmessage = null;
    };
    port.postMessage = function (data) {
      Promise.resolve().then(function () {
        if (typeof peer.onmessage === 'function') {
          peer.onmessage({ data: data, target: peer, currentTarget: peer });
        }
      });
    };
  }
  function __CivilMessageChannel() {
    this.port1 = new __CivilMessagePort();
    this.port2 = new __CivilMessagePort();
    __civilBindPort(this.port1, this.port2);
    __civilBindPort(this.port2, this.port1);
  }

  try {
    if (__useMCShim) {
      Object.defineProperty(window, 'MessageChannel', {
        value: __CivilMessageChannel, writable: true, configurable: true,
      });
      Object.defineProperty(window, 'MessagePort', {
        value: __CivilMessagePort, writable: true, configurable: true,
      });
      L('installed MessageChannel shim');
    } else {
      L('using existing MessageChannel');
    }
  } catch (e6) {
    try {
      if (__useMCShim) {
        window.MessageChannel = __CivilMessageChannel;
        window.MessagePort = __CivilMessagePort;
        L('installed MessageChannel shim via assignment');
      }
    } catch (e7) {
      L('MessageChannel shim install failed', String(e7));
    }
  }

  try {
    var __wrappedRealWS = window.WebSocket;
    var __WSWrap = function (url, protocols) {
      L('chii WebSocket open ->', url);
      var ws = protocols == null ? new __wrappedRealWS(url) : new __wrappedRealWS(url, protocols);
      ws.addEventListener('open', function () { L('chii WS open OK ->', url); });
      ws.addEventListener('error', function (ev) { L('chii WS ERROR ->', url); });
      ws.addEventListener('close', function (ev) { L('chii WS close ->', url + ' code=' + (ev && ev.code) + ' reason=' + (ev && ev.reason)); });
      return ws;
    };
    __WSWrap.prototype = __wrappedRealWS.prototype;
    __WSWrap.CONNECTING = __wrappedRealWS.CONNECTING;
    __WSWrap.OPEN = __wrappedRealWS.OPEN;
    __WSWrap.CLOSING = __wrappedRealWS.CLOSING;
    __WSWrap.CLOSED = __wrappedRealWS.CLOSED;
    Object.defineProperty(window, 'WebSocket', {
      value: __WSWrap, writable: true, configurable: true,
    });
  } catch (eW) { L('WebSocket logger install failed', String(eW)); }

  // Provide setImmediate + clearImmediate before target.js loads.
  // target.js bundles a setImmediate polyfill that first checks:
  //   v = self.setImmediate; Q = self.clearImmediate; if (v&&Q) skip polyfill;
  // If we pre-install a working setImmediate, the polyfill body (which uses
  // MessageChannel and breaks with ScramJet's broken MC) is never executed.
  // ScramJet does not wrap setImmediate (non-standard API), so this survives.
  if (typeof window.setImmediate !== 'function') {
    var __civil_si_tasks = {};
    var __civil_si_id = 0;
    window.setImmediate = function(fn) {
      var args = Array.prototype.slice.call(arguments, 1);
      var id = ++__civil_si_id;
      __civil_si_tasks[id] = function() { fn.apply(null, args); };
      Promise.resolve().then(function() {
        var t = __civil_si_tasks[id];
        if (t) { delete __civil_si_tasks[id]; t(); }
      });
      return id;
    };
    window.clearImmediate = function(id) { delete __civil_si_tasks[id]; };
    L('installed setImmediate shim');
  } else {
    L('setImmediate already present, skipping shim');
  }

  L('about to run target.js, ChiiServerUrl=', window.ChiiServerUrl);
  try {
    ${targetScriptText}
    L('target.js evaluated successfully');
  } catch (err) {
    L('target.js init threw', String(err));
    L('target.js init stack', err && err.stack);
  } finally {
    try {
      Object.defineProperty(window, 'WebSocket', {
        value: __savedWS, writable: true, configurable: true,
      });
      Object.defineProperty(window, 'fetch', {
        value: __savedFetch, writable: true, configurable: true,
      });
      Object.defineProperty(window, 'setImmediate', {
        value: __savedSetImmediate, writable: true, configurable: true,
      });
      Object.defineProperty(window, 'clearImmediate', {
        value: __savedClearImmediate, writable: true, configurable: true,
      });
      L('restored WebSocket/fetch/setImmediate');
    } catch (eR) {
      try {
        window.WebSocket = __savedWS;
        window.fetch = __savedFetch;
        window.setImmediate = __savedSetImmediate;
        window.clearImmediate = __savedClearImmediate;
        L('restored WebSocket/fetch/setImmediate via assignment');
      } catch (eR2) {
        L('WebSocket/fetch restore failed', String(eR2));
      }
    }
    try {
      Object.defineProperty(window, 'MessageChannel', {
        value: __savedMC, writable: true, configurable: true,
      });
      Object.defineProperty(window, 'MessagePort', {
        value: __savedMP, writable: true, configurable: true,
      });
      L('restored MessageChannel/MessagePort');
    } catch (e8) {
      try {
        window.MessageChannel = __savedMC;
        window.MessagePort = __savedMP;
        L('restored MessageChannel/MessagePort via assignment');
      } catch (e9) {
        L('MessageChannel restore failed', String(e9));
      }
    }
  }
})();`;
}
