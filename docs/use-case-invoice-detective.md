# Invoice Detective: billing support demo

## Demo in one sentence

Show a task-specific small language model investigate a customer's disputed charge, use account data to identify the invoice, and open the right billing case—even when the customer is upset and asks for a human.

## Why this is the first use case

The [Brightpath support dataset](https://github.com/distil-labs/distil-mutators-support-dataset) models a fictional team task-management SaaS. Its starter training split has only two billing-dispute examples out of 50, while its test split includes 20 billing cases out of 55. That gap makes billing a clear, demonstrable test of whether targeted examples help a small model handle a rare but important workflow.

This is a support-workflow demo, not an autonomous refund system. The model can open a case. Billing reviews it within two business days; if approved, a refund goes to the original payment method within 5 to 10 business days.

## The showcase scenario

Preload a fictional customer and account fixture with a renewal invoice and a matching duplicate charge. The exact invoice ID and amount must come from the `get_subscription` result, never from a hard-coded model answer.

**Customer:**

> You charged me twice for my renewal. I want the extra charge refunded, and I want to speak to a person. The account email is alex@example.test.

**Expected model flow:**

1. Acknowledge the issue briefly and call `get_subscription` for the confirmed account email.
2. Read the returned invoices and select the invoice associated with the duplicate charge.
3. Call `open_billing_case` with the returned invoice ID, `case_type: "double_charge"`, the verified disputed amount in EUR, and a short description grounded in the customer's words.
4. After the tool returns successfully, tell the customer the case number and that billing reviews cases within two business days. Explain that a refund is not confirmed until billing approves the case.

The billing rule takes precedence over the general request-for-a-human rule: do not call `transfer_to_human` for a billing dispute. If the account email is missing or ambiguous, ask for it before looking up an account. If the tool cannot verify an invoice or amount, do not open a case with guessed values.

## Product UI

Keep the demo on one screen, with the conversation in the center and the evidence and actions visible alongside it.

- **Header:** Brightpath Support, “Invoice Detective” and a small “SLM demo” indicator.
- **Scenario picker:** Double charge, wrong seat count, missing VAT. Start with Double charge. Include a reset/replay control for a repeatable presentation.
- **Chat:** Customer message, concise assistant responses, and clear in-progress states while tools run.
- **Account panel:** After lookup, show the plan, billing period, recent invoices, and highlight the invoice selected by the model.
- **Case panel:** Before submission, show the proposed case type, invoice ID, amount, and description. After success, show the returned case number and review timeframe.
- **Action trace:** A small, human-readable sequence: “Subscription checked” → “Invoice matched” → “Billing case opened.” Do not expose raw prompts or internal logs.

The visual payoff is the verified invoice being highlighted and the case panel changing to **Case opened**. Never show “refund issued” unless a separate refund system actually confirms that action.

## Model and tool scope

Use Distil Labs' `chat-completion-agentic` task type so the model learns the tool loop: make a call, read its result, then continue the conversation. The demo app is responsible for executing the declared tools and returning their results to the model.

Keep the first model focused on billing disputes. Its core tools are:

- `get_subscription(email)` to retrieve the customer's plan and recent invoices.
- `open_billing_case(email, invoice_id, case_type, amount, description)` to create the case.

Keep `transfer_to_human` available in the tool schema if the project wants to demonstrate correct tool selection under pressure. State clearly in the job description that billing disputes are resolved by opening a case and must not be transferred. Other support intents can be excluded from this first billing model.

## Distil Labs data plan

1. Start from the Brightpath dataset's `job_description.json` and tool schemas, but rewrite the task description to cover billing only.
2. Keep the existing billing examples as seed material. The two billing rows in the original train split are not enough coverage on their own.
3. Generate additional billing conversations for three scenario families: duplicate charge, invoice error (wrong seats or VAT), and refund request. Vary customer wording, tone, invoice history, and whether the customer asks for a human.
4. Keep the original test rows held out. Do not copy test conversations into training. Build a billing-focused test slice or a separate billing-only test file for evaluating this model.
5. Review generated examples and tool results for consistency before training. Every tool call in a conversation should use values present in the corresponding fixture/tool result.

Example mutator fragment for a focused first run:

```yaml
synthgen:
  mutators:
    - name: billing_scenario
      description: the billing problem the customer needs resolved
      target_distribution: [0.40, 0.35, 0.25]
      values:
        - "a duplicate charge on a renewal; the customer may be frustrated or ask for a human"
        - "an invoice error involving a wrong seat count or VAT; use the invoice and account details returned by the lookup"
        - "a refund request related to a cancelled subscription; explain that approval is required before a refund is issued"
```

The target percentages shape synthetic training data; they are not model scores. Inspect generated samples before running a full training job. If the generator misses a scenario or produces inconsistent tool calls, improve the seed conversations or mutator descriptions first.

## Demo success criteria

The demo passes only if the model:

- Looks up the account before choosing an invoice.
- Uses an invoice ID and disputed amount returned by the lookup.
- Selects `double_charge`, `invoice_error`, or `refund` to match the evidence.
- Opens the case with a grounded description and reports the case number only after the tool succeeds.
- Does not transfer a billing dispute to a human, even when asked.
- Does not invent invoice details, claim a refund was issued, or promise case approval.

Evaluate these behaviors on held-out billing cases and compare the trained SLM against the untrained or baseline model using the same fixtures. Track full-workflow success and incorrect tool arguments, not just whether the final message sounds helpful.

## References

- [Brightpath support dataset](https://github.com/distil-labs/distil-mutators-support-dataset)
- [Distil Labs conversation task types](https://www.distillabs.ai/docs/build/dataset/chat-completion/)
- [Distil Labs synthetic data and mutators](https://www.distillabs.ai/docs/build/synthetic-data/)
