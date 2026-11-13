# Native Chrome resource detection, 10 November 2026

Chrome **156.0.8078.80** runs Civil's actual `getFilters()` implementation against
two inert extension fixtures. The initial result is empty. After fixture loading,
the result contains exactly `prismaBrowser` and `classlinkOneClick`.

Each fixture uses its signed package's publisher key, version, resource
declarations and exact fingerprint bytes. CRX3 verification and the derived ID
are asserted before loading. The fixtures contain resource files and a minimal
manifest. Browser execution therefore tests resource accessibility and detection.
The deployed vendor workers, native companions and managed policy require
separate environments.

| Detected key | Resource | Native HTTP status | SHA-256 |
|---|---|---|---|
| `prismaBrowser` | `block.html` | 200 | `aab055960cad7c80fc6ebd1f98dc92136afde61c06550103fa3c9cc0021efc27` |
| `classlinkOneClick` | `images/128x128.png` | 200 | `16bdd12a47ae1b84681172c04f204146393b699e22db76c8feb3ae47cdcbd01d` |

Both fixtures also contain a private resource outside their accessible-resource
declarations. Chrome denies both private requests. The browser calls use the
same GET, omitted credentials, redirect rejection and cache behavior as Civil's
detection helper. Resource bytes returned by Chrome match the retained files.

The actual detection source is bundled locally with the installed esbuild.
The fixture server binds `127.0.0.1` and serves two exact paths. Its content
security policy permits its own script and extension-resource connections.
Chrome uses an owned profile inside the ignored audit directory. The first
sandboxed attempt failed to reach loopback. The authorized local run passed,
closed Chrome and stopped its server.

Reproduce with the retained packages and installed Chrome:

```powershell
node extensions/filter-audit-2026-11-10/war-browser/replay.cjs
```

`browser-replay.json` records source/bundle hashes, authenticated package and
resource hashes, fixture locations, native browser version and results.
The script's assertions and formatting checks pass. Every authored function
stays within 60 lines. The remaining three new targets retain their existing
resource-availability limits.
