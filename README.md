# Cover Letter Generator

A static, single-page app. No backend, no server, nothing to deploy except the built files.
It runs entirely in the visitor's browser: each person pastes in their own Anthropic API key,
their own resume, and a job description, and the browser calls Anthropic directly.

## How this avoids needing a backend

Anthropic's API supports direct browser requests if the request includes the header
`anthropic-dangerous-direct-browser-access: true` (Anthropic's own name for it, not mine).
It exists specifically for "bring your own key" tools like this one: each visitor's key is
typed into the app, saved only in their own browser's local storage, and sent straight to
`api.anthropic.com` when they click Generate. It is never sent to you, never committed to
the repo, and never touches any server you run, because there is no server.

The tradeoff: whoever pastes in a key pays for their own usage, directly to Anthropic, at
standard API rates. There is nothing to configure or pay for on your end beyond hosting the
static files, which is free.

## Local development

```
npm install
npm run dev
```

Opens at http://localhost:5173. You'll need your own Anthropic API key to test the Generate
button — get one at https://console.anthropic.com/settings/keys.

## Deploy to GitHub Pages (free)

1. Push this project to a new GitHub repository.
2. Install dependencies once: `npm install`
3. Deploy:
   ```
   npm run deploy
   ```
   This builds the app and pushes the `dist` folder to a `gh-pages` branch using the
   `gh-pages` npm package (already included as a dev dependency).
4. In your repository on GitHub: Settings → Pages → set the source branch to `gh-pages`.
5. GitHub will give you a live URL, typically `https://your-username.github.io/your-repo-name/`.

Re-run `npm run deploy` any time you change the code.

### Alternative: GitHub Actions (auto-deploy on every push)

If you'd rather it redeploy automatically whenever you push to `main` instead of running
`npm run deploy` by hand, add a workflow file to auto-build and publish `dist` on push. GitHub's
own guide covers this exact Vite setup: https://vitejs.dev/guide/static-deploy.html#github-pages

## Other free static hosts

Nothing here is GitHub-specific beyond the `gh-pages` deploy script. The build output in
`dist/` after `npm run build` is a plain static site, so Vercel, Netlify, Cloudflare Pages,
or Firebase Hosting all work exactly as well if you'd rather use one of those instead.

## A note on the API key field

Browser local storage is not a vault. Anyone with physical access to the same browser
profile, or a malicious browser extension, could theoretically read it. This is the same
tradeoff every "paste your API key into a web app" tool makes, and it's why the app never
sends your key anywhere except directly to Anthropic. If that tradeoff doesn't sit right
with you, don't save a long-lived key here. Anthropic's console lets you scope and revoke
individual keys, so treat this the way you'd treat any key you paste into a third-party tool.
