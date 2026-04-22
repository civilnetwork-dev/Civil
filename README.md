### Civil Proxy

To simply state what this is:

It's **your** web proxy.

To state what this is in a more attractive and organized way:

Ditch those useless blocker annoyances with Civil, an open-source and quite original proxy solution. Get your hands on some of the world's most fun and personalized experiences with our built-in apps, games, features, and tooling! Again, it's **your** web proxy.

Why use Civil?

Here are the some of the countless and evergrowing philosophies and norms that we operate under at Civil:

- Information should be free (or should we say Aaron Swartz lives on...idk??)

- Open source proxies should be transparent about annoyances like tracking and telemetry. But... fortunately we don't even operate under those practices! We don't do popular tested telemetry solutions like OpenTelemetry, however, we do use analytics; Plausible with its <1KB tracker SDK for the sake of our users (no cookies!).

- Websites should be simplistic even when delivering animations and ViewTransitions, and should not complicate the browsing experience, especially in the world of a proxy.

- Websites should be small and fast to support low-end hardware and should not complicate the money and time required for users to smoothly browse. TL;DR this is why hydration and rendering strategies like ISR and SSR have been put in place in frameworks like Next.js. We don't use Next.js, however. This is because the strategies their engineering team uses are not ideal for supporting high latency network connections and smooth throughput on low-end devices, plus the fact that it's been made close to impossible to deploy Next.js apps on alternative platforms to Vercel like CloudFlare Pages and Netlify. Because of that, we use the SolidStart metaframework with the Vinxi, Nitro, and Seroval projects. You can find a full list of the countless technologies we use and why we use them at TECHNOLOGY.md

- Web proxies should be very deployable and easy to self-host with tooling like Docker or PodMan. TL;DR we are soon going to put some *working* deploy configuration files and maybe scripts in a separate repository.

- Websites should not only be small and fast-loading, but also optimized. We use ESBuild to transpile our strongly-typed UV, ScramJet, and SW scripts for use on the client, making our proxy a little more optimized than the average web proxy. Plus, we rewrote the UV and ScramJet encoding methods in safe, modern, and optimized C++ to ensure speed, quality, and robustness, and transpiled it to WebAssembly with Emscripten. The RammerHead encoding, however, is written in optimized Rust using WasmBindgen.

TL;DR as a side notice we are probably going to include ads and donations on the proxy, but the ads are not going to be put in place with Google AdSense, but rather the more new and lightweight [GhostAds](https://ghostads.io/) once and if it releases.

The license?

This project is licensed under the very freedom-provoking WTFPL:

```text
            DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE
                    Version 2, December 2004

 Copyright (C) 2004 Sam Hocevar <sam@hocevar.net>

 Everyone is permitted to copy and distribute verbatim or modified
 copies of this license document, and changing it is allowed as long
 as the name is changed.

            DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE
   TERMS AND CONDITIONS FOR COPYING, DISTRIBUTION AND MODIFICATION

  0. You just DO WHAT THE FUCK YOU WANT TO.
```