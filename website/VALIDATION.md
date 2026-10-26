# Website 1.0.0 validation

Validated on 26 October 2026 using Node.js 24 and Chromium against the production static export.

- Next.js production build, prerendering and TypeScript checks pass.
- Full npm dependency audit reports zero vulnerabilities at validation time.
- Browser checks cover all 21 commands, category filters, search and empty results, expanded subcommands, clipboard copying, light/dark theme persistence, Discord preview switching, the browser RPS round, FAQ expansion, invite URL and mobile navigation.
- Viewports 320, 390, 768 and 1440 pixels have no horizontal page overflow. Desktop, mobile and dark-theme screenshots were inspected.
- No browser JavaScript errors or failed asset responses in the checked flows. Rendering needs no external fonts, images or private bot API requests.
- Both ZIPs pass CRC verification; the source archive excludes node_modules, .next, .git and private environment files. Static index.html is at archive root.

Discord authentication, an actual bot invite and Vercel account deployment require the corresponding user account access. No production Discord or MongoDB data is accessed by this website.
