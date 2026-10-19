# Distill Desk

Small models. Less support drama.

A hackathon customer-support web app for handling login, subscription, and billing issues with a task-specific small language model.

## Planned features

- Help customers reset passwords after confirming their email.
- Look up subscription details and answer plan questions.
- Investigate billing issues and open cases for the relevant invoice.
- Hand off to a human according to the support policy.

## Tools

- **distil labs:** generate training examples and fine-tune the support model.
- **Langfuse:** trace conversations and evaluate model behavior.
- **Runpod:** serve the trained model.

## Dataset

We are starting with the [Brightpath support dataset](https://github.com/distil-labs/distil-mutators-support-dataset), which includes seed conversations, evaluation cases, tool schemas, and mutator configurations.

## Demo use case

The first demo focuses on **Invoice Detective**: investigate a suspicious charge, identify the correct invoice, and open a billing case. See the [use-case brief](docs/use-case-invoice-detective.md) for the scenario, UI, model behavior, data plan, and evaluation criteria.

## Status

Initial project setup. The first demo use case is defined; application code and training results will follow.
