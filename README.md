# Realtime Lab

Experimental native Obsidian collaboration plug-in for independent test vaults on iPhone and desktop. Yjs and CodeMirror 6 merge concurrent edits to one test note. This repository and its releases contain no connection credentials, personal notes, test-vault snapshots, or private server addresses.

## Install with BRAT

1. In Obsidian, create an empty vault named `Realtime-Lab-iPhone` or `Realtime-Lab-MacBook`. Do not enable any other sync plug-in in this vault.
2. Install and enable BRAT from Community Plugins once.
3. In BRAT, add `ns19920320-cyber/obsidian-realtime-lab`, install Realtime Lab, and enable it. [Open the BRAT installer](obsidian://brat?plugin=ns19920320-cyber%2Fobsidian-realtime-lab).
4. Open Realtime Lab settings and press **初始化** (Initialize), or run **Realtime Lab: 初始化当前独立测试库**. This creates the marker and `实时协作测试.md` inside this test vault. No hidden-folder copying is necessary.
5. Configure your own WebSocket server URL and access token, then connect. Use `wss://` for public endpoints. Keep private connection pairing separate from the public installation QR.
6. Both devices edit the same test note in editing mode. Verify phone-to-desktop, desktop-to-phone, simultaneous typing, disconnect/reconnect, Chinese composition, and undo before considering any broader use.

The plug-in refuses to connect unless the vault name starts with `Realtime-Lab-` and it has an explicit isolated-lab marker. Initialization refuses other vault names. It also rejects connecting while LiveSync is enabled in the test vault. It does not scan or sync the rest of your vault.

## What is tested

Automated transport tests cover simultaneous operations, reconnect, persisted client state, server restart, authorization, and fixed-room path isolation. Actual CodeMirror tests cover concurrent changes, cursor mapping, per-user undo, and composition-style replacements. Guard tests check that a regular vault is rejected before any file read. iPhone Safari testing does not establish native Obsidian compatibility: real iPhone and desktop Obsidian acceptance is still required. This is an experimental release, not a production data safety certification.

## Build and test

Node.js 22:

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run privacy-check
```

Release assets are `main.js` and `manifest.json`, individually attached to the matching version release for BRAT. No `data.json` is distributed.

## Standalone test server

```sh
npm start
```

Default listener: loopback port 17236. A random authentication token is generated in `work/server-data/token` if LAB_TOKEN is not supplied. Keep this directory private. LAB_HOST, LAB_PORT and LAB_DATA_DIR may override deployment values. A production TLS reverse proxy must supply WSS when using your own public subdomain; do not expose plain WebSocket traffic on the public internet.

Each update is persisted to an atomic binary snapshot before confirmation. This small single-room experiment has no database/notes browser, attachment sync, file discovery, rename/delete support, revision UI, or background-execution guarantee on iOS. Client snapshots use the plug-in's local settings file instead of IndexedDB. The final 200ms client snapshot window is not crash-proof; divergent Markdown is preserved as a separate recovery file on startup.

## Optional connection import

After installation and initialization, an `obsidian://realtime-lab?url=...&token=...` link can import a connection into the current independent vault. The plug-in requires explicit confirmation and displays the target origin. Such a link contains a secret and must never be placed in the public installation QR or repository. A generic BRAT installation link contains only the repository name.

References: [Yjs updates](https://docs.yjs.dev/api/document-updates), [BRAT developer guide](https://tfthacker.com/brat-developers).
