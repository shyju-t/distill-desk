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

## Status

Initial project setup. Application code and training results will follow.
