# Distill Desk model

A small support assistant for Brightpath, a fictional task-management app. It handles login, pricing, billing disputes and human handoff using four tools. Aaron owns the model and endpoint; the app teammate owns the UI and tool execution.

We use the [distil labs support dataset](https://github.com/distil-labs/distil-mutators-support-dataset): 50 seed chats and 55 held-out test chats. Billing disputes appear in only 2 seed chats but 20 test chats. Our fixed intent mutator targets 2,000 synthetic chats, with 35% billing disputes, to close that gap.

## Status and numbers

Build in progress on 19 October 2026. The trained student is **not serving yet**.

| Measure (55-case test set) | Teacher GLM-5.3 | Untrained Qwen3.5-2B | Trained Qwen3.5-2B |
| --- | --- | --- | --- |
| Tool-call equivalence | 78.60% | Pending | Pending |
| LLM judge | 84.72% | Pending | Pending |
| Reference-free judge | 66.81% | Pending | Pending |
| ROUGE | 0.3691 | Pending | Pending |
| Measured endpoint latency | Pending | Pending | Pending |

These are separate evaluation measures, not a single accuracy score. Student improvement and speed claims await measured results.

## Pipeline

`config.yaml` is an unchanged copy of `configs/fixed-mutator.yaml` used in the run; `job_description.json` is the exact task and tool contract. Teacher: `zai.glm-5.3-low-thinking`; student: `Qwen3.5-2B`; four epochs, LoRA rank 64, seed 123.

Run from a folder containing the two source JSONL files and these two configuration files:

```sh
distil dataset create --train train.jsonl --test test.jsonl --config config.yaml --job-description job_description.json --output json
# Uploaded dataset: 51c1e7ed-8999-47ed-91bc-d44242bbb662
distil dataset generate-synthetic-data-train 51c1e7ed-8999-47ed-91bc-d44242bbb662 --output json
# Synthetic dataset: 5418c08e-128a-4785-9725-ec37930ded11
distil teacher-evaluation create-from-dataset 51c1e7ed-8999-47ed-91bc-d44242bbb662 --output json
# Teacher evaluation: f378c4fe-d47b-4c3e-9fb7-deec73ab85fa
```

The upload used the same config under its original `configs/fixed-mutator.yaml` path. Synthetic generation is running. The remaining pipeline is queued; IDs will be filled after success:

```sh
distil slm create-from-dataset 5418c08e-128a-4785-9725-ec37930ded11 --output json
distil slm metrics <SLM_ID> --output json
distil slm download-metadata --destination metadata <SLM_ID> --output json
distil deployment create-from-slm <SLM_ID> --output json
distil inference-endpoint create-from-deployment --name tedix-support --fallback-model openai/gpt-oss-120b <DEPLOYMENT_ID> --output json
```

SLM ID: **pending**. Deployment ID: **pending**. Trained endpoint name: **pending**. API-key linking is handled privately by Aaron.

## App contract

- Base URL: `https://inference.distillabs.ai/v1`, OpenAI-compatible `POST /chat/completions`.
- `model` must be the **unique endpoint name**, not `Qwen3.5-2B` or a deployment ID. Trained name is pending.
- Fallback-only endpoint already used by the demo lane: `tedix-support-teacher-MEiqM9`. It serves `openai/gpt-oss-120b`, which is distinct from the GLM training teacher. Use it only as a clearly labelled fallback comparison.
- Send `job_description.json.task_description` verbatim as the first **system** message, followed by the conversation in OpenAI chat format. Send `job_description.json.tools` on every call, with `temperature: 0` and `max_tokens: 1024`.
- Downloaded `model_client.py` is pending; the current contract follows the build lane's working `run_demo.py`. It will be checked against the generated client after training.
- For `tool_calls`, append the complete assistant message, execute or simulate each declared tool, then append `{ "role": "tool", "tool_call_id": "<returned id>", "content": "<JSON result string>" }` and call again. Keep the full conversation. Show text when there are no tool calls. The supplied clients make one call and never execute tools.
- Demo tool results are fictional fixtures. Do not claim that a reset, refund or account change actually happened.

An illustrative request/response (not a measured trained-model transcript):

```json
{
  "model": "REPLACE_WITH_TRAINED_ENDPOINT_NAME",
  "messages": [
    {"role": "system", "content": "<exact task_description from job_description.json>"},
    {"role": "user", "content": "What does the Team plan cost?"}
  ],
  "tools": ["<the four full tool objects from job_description.json>"],
  "temperature": 0,
  "max_tokens": 1024
}
```

```json
{"choices":[{"message":{"role":"assistant","content":"Team costs 8 EUR per seat per month. Yearly billing includes two months free."}}]}
```

The clients below expand the exact system prompt and tool objects for you.

## Run locally / keep warm

Ask Aaron privately for the API key. Never put it in Git, a browser bundle, logs or slides. Copy `.env.example` to `.env`, fill it privately, and export its values in your shell (the callers read environment variables; they do not load `.env` automatically).

```sh
python3 -m pip install openai
set -a
. model/.env
set +a
python3 model/client.py "What does the Team plan cost?"
# Optional: foreground ping every 20 minutes; Ctrl-C to stop.
python3 model/keepwarm.py
```

`client.ts` exports `complete(messages)` for a server-side Node/TypeScript app and uses native `fetch`; no OpenAI JS SDK is required. Both clients read `DISTIL_BASE_URL`, `DISTIL_MODEL`, and `DISTIL_API_KEY`. Use the same key only for the endpoint(s) Aaron has linked it to.

The planned trained endpoint has a server-side `openai/gpt-oss-120b` fallback. On expiry the endpoint can answer through fallback, so an HTTP success alone does not prove the student served the request. Record routing/model metadata where available and label fallback results. Clients surface request errors; they do not silently switch models.

Hackathon deployments stop after **six hours or one idle hour** and cannot be restarted. A ping about every 20 minutes helps avoid idle shutdown until the demo, but cannot extend the six-hour lifetime or revive a stopped deployment. Keep-warm is optional and is not started by importing these files.
