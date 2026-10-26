# Gatekeeper website

A responsive Next.js 16 + React 19 website with a liquid-glass theme, light/dark modes, interactive Discord previews, all 21 bot commands with search and category filters, five game previews, a playable browser RPS demo, setup guidance and FAQs.

This is the public bot website. Server administration stays in Discord. It does not implement Discord OAuth login or connect to the private bot API. Preview messages are explicitly labeled and do not claim to be live activity.

## Run locally

Use Node.js 24 (22.12+ supported).

```sh
npm ci
npm run dev
```

Open http://localhost:3000. All styles and icons are bundled; no external font, analytics, image or API requests are needed to render the site.

## Configure

The invite link defaults to Gatekeeper's existing public Discord application ID, `1106164007519408128`. To change it, copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_DISCORD_CLIENT_ID`. Invite permissions cover messaging, reactions, message cleanup, roles, audit logs and timeouts, without requesting Administrator. Assign additional permissions in Discord for features such as kicks/bans if needed. Discord requires the inviting account to have permission to manage the destination server.

Public variables are baked into the browser bundle at build time. Never put the bot token, MongoDB URI or `BOT_API_SECRET` here. This website needs none of them.

If hosted at a subpath, set `NEXT_PUBLIC_BASE_PATH=/repository-name` **before building**. Leave it empty for a domain root. Theme preference is stored locally in the browser; clipboard access may require HTTPS. All content remains readable without JavaScript, while interactive controls require it.

Command definitions in `components/commands.json` were generated from the bot's current command builders. Update the catalog when adding or renaming bot commands. The footer links to bot v3.0.2; update that link for future bot releases.

## Build and ZIP

```sh
npm run build
npm run typecheck
npm run package
```

`dist/gatekeeper-website-source.zip` contains the editable Next.js project and lockfile, excluding dependencies, private environment files and build caches. Extract it and run `npm ci` before developing or building.

`dist/gatekeeper-website-static.zip` contains the built `out/` directory with **index.html at the ZIP root**. Extract it into your static host's public directory. It needs no Node process, database or environment variables at runtime. Serve the directory over HTTP/HTTPS; opening index.html directly with file:// is not supported. To preview an extracted static build locally, `python3 -m http.server 3000` is one option.

The packaging script also writes `manifest.json` and `SHA256SUMS.txt`. ZIP creation uses only Node's standard library. Rebuild after editing any content or public variables.

## Deploy

- **Static hosting:** upload/extract the static ZIP, with `index.html` and `_next/` at the public root. Disable SPA rewrites that send JavaScript asset requests to index.html.
- **Vercel:** import the repository, choose `website` as the Root Directory, and use the detected Next.js preset. Run the standard `npm run build` command; the project uses static export.
- **Other Git hosts:** choose `website` as the root, install with `npm ci`, build with `npm run build`, and publish `out`.

Host this website separately from the 512 MB Wispbyte Discord bot container. Static hosting does not add a second Node.js process to that container. Existing bot startup files, environment variables and MongoDB data do not change.

The repository's website workflow audits dependencies, typechecks, builds and creates both ZIPs. New website versions are published as `website-v<version>` GitHub releases, without changing the latest bot release.
