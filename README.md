# Vidya Feedback Automator

Choose a rating for all pending forms, or choose one per faculty member. The app connects to Vidya ERP, fills each question, submits each form, and checks that ERP reports its state as `submitted`.

## Run locally

Requires Node.js 20.9 or newer.

```sh
npm ci
npm run dev
```

Open http://localhost:5000. Enter your ERP credentials in the form. Credentials are sent to this app’s server for authentication with ERP; the app does not persist them. No credentials belong in source code or environment files.

```sh
npm test
npm run build
npm start
```

## Submission fix

The ERP’s live feedback form defines its Submit button with `context="{'from_ui_button': True}"`. The automator now includes that context in the button call. It then reads the form’s `state` and counts success only when it is `submitted`. Draft and Edit forms are eligible; already submitted forms are skipped. Failed forms are shown separately and can be retried.

`src/lib/submit-feedback.mjs` contains the submission and verification logic. Regression tests cover the required button context, unconfirmed states, and server failures. The form definition was inspected using read-only authenticated requests; no real feedback was submitted during development.

## Interface

Responsive setup and progress panels, explicit rating selection, per-faculty review, password visibility, accessible labels and focus states, reduced-motion support, and clear confirmed/failed totals. Activity details are available in an expandable log.

The college ERP itself is not modified. This repository is a separate app and needs a Node-compatible host with outbound access to the ERP. Use HTTPS when hosting it.
