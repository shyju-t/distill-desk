# Brightpath Support

A small Next.js customer-support chat for a future Distil Labs model endpoint. Without a configured endpoint, the API returns a clear `MODEL_NOT_CONNECTED` error. It never generates a placeholder AI answer.

## Start on Windows

```powershell
cd C:\Users\saish\Desktop\distill\distill-desk
Copy-Item .env.example .env.local
npm.cmd install
npm.cmd run dev
```

Open http://localhost:3000. Use `npm.cmd` where PowerShell blocks the `npm.ps1` shim.

## Connect a model

Set these server-side values in `.env.local` and restart the server:

```dotenv
DISTIL_API_URL=https://your-host/v1/chat/completions
DISTIL_API_KEY=your-secret
DISTIL_MODEL=your-model-id
```

The first adapter in [src/lib/provider.ts](src/lib/provider.ts) uses an OpenAI-compatible chat-completions wire format. Change `OpenAICompatibleProvider.complete` and `normalizeOpenAIResponse` when Distil Labs supplies a different endpoint contract. The rest of the app uses the `ChatProvider` interface. Never prefix the API key with `NEXT_PUBLIC_`.

## Demo use case

The first demo focuses on **Invoice Detective**: investigate a suspicious charge, identify the correct invoice, and open a billing case. See the [use-case brief](docs/use-case-invoice-detective.md) for the scenario, UI, model behavior, data plan, and evaluation criteria.

## Status

Initial project setup. The first demo use case is defined; application code and training results will follow.
## API

`POST /api/chat` accepts `{"messages":[{"role":"user","content":"I was charged twice this month."}]}`.

It returns `{"message":{"role":"assistant","content":"<actual model text>"},"toolCalls":[],"latencyMs":<measured number>,"history":[]}`. `history` is the ordered user, assistant, tool-call, and tool-result history to send on the next turn. Errors have the shape `{"error":{"code":"MODEL_NOT_CONNECTED","message":"..."}}` with a non-2xx status. `GET /api/chat` reports only `{"connected":boolean}`.

## Support tools

The official [Brightpath dataset](https://github.com/distil-labs/distil-mutators-support-dataset) is stored under `data/`. `job_description.json` supplies the policy and tool schemas. The train and test files supply known mock account and invoice data; they are never used for training by this app.

`send_password_reset`, `get_subscription`, `open_billing_case`, and `transfer_to_human` run only as simulations. Arguments are checked against the official schemas. Unknown accounts and invoices yield explicit errors. A billing case requires an earlier subscription lookup. The API caps each request at four tool rounds and eight calls. If the model endpoint does not support tools, the adapter reports that limitation instead of fabricating actions.

## Checks

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

The UI supports Enter to send, Shift+Enter for a new line, retry, optional tool details, and multiple chats kept in session storage.
