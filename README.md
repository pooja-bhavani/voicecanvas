# Voice Canvas

<img width="1470" height="885" alt="Screenshot 2026-10-25 at 1 48 26 pm" src="https://github.com/user-attachments/assets/f25cf9e3-9b40-403b-8c85-60de40130b48" />

Voice Canvas turns spoken or typed infrastructure requirements into a visual cloud architecture and reviewable Terraform and Docker Compose drafts. The diagram uses React Flow, the interface is styled with Tailwind CSS, and the optional generation API uses Gemini from a Next.js server route.

Generated infrastructure is a starting point, not a deployment. Review and test all generated configuration before applying it.

## Requirements

- Node.js 20.9 or later
- npm
- A Gemini API key for Gemini generation. The local visual-draft fallback works without one.
- Optional: Wispr Flow for voice dictation. Voice Canvas receives text inserted by Wispr Flow; it does not record or transcribe audio itself.

## Set up and run

1. **Install dependencies.**

   ```bash
   npm ci
   ```

2. **Create the local environment file.**

   ```bash
   cp .env.example .env.local
   ```

3. **Configure Gemini (optional).** Open `.env.local` and replace the `GEMINI_API_KEY` placeholder with a key from Google AI Studio. Optionally set `GEMINI_MODEL`; it defaults to `gemini-2.5-flash`.

   Keep the key in `.env.local`. Do not put credentials in `.env.example`, source files, or architecture prompts. `.env.local` is excluded from Git.

4. **Start the development server.**

   ```bash
   npm run dev
   ```

5. **Open the app.** Visit [http://localhost:3000](http://localhost:3000).

   Next.js loads `.env.local` when the server starts. Restart the server after changing environment variables.

## Test the app step by step

1. **Confirm the sample diagram loads.** The initial canvas shows a sample payments architecture. Use the zoom controls, drag nodes, or click a node to inspect it.
2. **Enter an architecture request.** In **Speaker Cloud Infrastructure**, type a request or dictate into the text area using Wispr Flow. Hold its Function key while speaking and release it to insert the dictated text.
3. **Submit the request.** Click **Generate architecture** or press **⌘+Enter** on macOS / **Ctrl+Enter** on Windows or Linux. Dictation is not submitted automatically.
4. **Check the result.** When Gemini is configured and available, the app displays Gemini-generated notes, services, Terraform, and Compose output. The canvas and inspector update from the same result.
5. **Check the local fallback.** If Gemini is not configured, unavailable, rate-limited, or returns an invalid response, Voice Canvas preserves the request and displays a browser-generated draft. The status explains why Gemini was not used when the server can identify the error. The fallback is a lightweight visual draft, not an AI interpretation of every requirement.
6. **Inspect the output.**
   - **Overview** shows the architecture summary, components, and speaker notes.
   - **main.tf** shows the generated Terraform draft.
   - **docker-compose.yml** shows the generated Compose draft.
7. **Try export actions.** In either configuration tab, use **Copy** or **Download** to export the displayed file.
8. **Reset the example.** Click **Try Sample Architecture** to clear the generated result and restore the sample.

### Validation commands

Run the TypeScript check and production build:

```bash
npm run typecheck
npm run build
```

Run the production server after building:

```bash
npm start
```

There is currently no separate automated test-suite script. The steps above are the manual UI smoke test; the two commands validate types and the production build.

## App sections

### Header

The header identifies Voice Canvas and includes **Try Sample Architecture**, which resets the current generated result and restores the sample.

### Speaker Cloud Infrastructure

This text area accepts typed requirements and text inserted by Wispr Flow. On submit, the browser sends the text to `POST /api/architecture`. The server route calls Gemini with the API key from the server environment. The key is never sent to the browser. The request is limited to 6,000 characters.

The Function-key hint describes the Wispr Flow dictation workflow; the key is handled by Wispr Flow, not by Voice Canvas. Do not include passwords, API keys, or other secrets in the prompt: prompt content is sent to Gemini when Gemini generation is enabled.

### Architecture canvas

The React Flow canvas displays draggable, selectable service nodes and animated connections. It includes a dot-grid background, zoom and fit controls, and an operational or visualization-only status. Generated services include visual categories such as internet, CDN, gateway, application service, worker, event stream, database, and cache.

Clicking a node displays its description in the inspector. Click an empty part of the canvas to clear the selection.

### Inspector - Overview

The dark inspector's **Overview** tab shows the architecture summary, component counts, generated speaker notes, and production-oriented reminders. Selecting a node displays its details here.

### Inspector - main.tf

The **main.tf** tab displays the Terraform text returned for the current architecture (or the sample Terraform before generation). Use **Copy** or **Download** to export it.

### Inspector - docker-compose.yml

The **docker-compose.yml** tab displays the Docker Compose text returned for the current architecture (or the sample Compose file before generation). Use **Copy** or **Download** to export it.

Both generated files are drafts. Review the contents, provider and service versions, network rules, secrets handling, costs, and deployment assumptions before running Terraform or Docker Compose.

## Generation and fallback behavior

- `app/api/architecture/route.ts` validates the request, calls Gemini using `GEMINI_API_KEY`, validates the structured response, and returns architecture data to the browser.
- `app/page.tsx` submits prompts, renders the inspector, and creates a local visual draft if the route reports an error.
- `app/architecture-canvas.tsx` maps generated services to React Flow nodes and connections.
- `app/lib/architecture.ts` defines the shared architecture data types.
- The free Gemini tier can impose per-model request limits. A daily quota exhaustion requires waiting for the reset or checking the project's Google AI Studio quota and billing; retries cannot restore an exhausted quota.

## Project structure

```text
app/
  api/architecture/route.ts   Gemini-backed server endpoint
  lib/architecture.ts         Shared architecture types
  architecture-canvas.tsx     React Flow diagram and generated nodes
  globals.css                 Tailwind imports and canvas styles
  layout.tsx                  Root layout and page metadata
  page.tsx                    Prompt form, fallback, inspector, and exports
.env.example                  Environment-variable template
postcss.config.mjs             Tailwind CSS PostCSS configuration
```
