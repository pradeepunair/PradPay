# ADR-0004: Use Vercel Workflow subject to a deployed durability spike

- Status: proposed
- Date: 2026-09-08
- Owner/reviewer: Pradeep Nair / pending

## Context

The agent flow must pause for human approval and provider authentication, resume
after callbacks, retry safe steps, survive deployment/process loss, and continue
payment reconciliation with every browser closed.

The verified team is on Vercel Hobby. Current public pricing lists 50,000
workflow events/month and 1 GB of workflow storage writes for Hobby, without
on-demand overage; Vercel documents that a Hobby team can be paused after
included usage is exhausted. The application's own admission and reconciliation
design therefore cannot depend solely on platform exhaustion behavior.

## Options considered

1. Vercel Workflow for durable steps, hooks, sleep, and observability.
2. Vercel Queues plus an explicit persisted state machine/outbox.
3. External durable workflow/queue service.
4. Long-running HTTP functions or in-process timers.

Option 4 is rejected. Vercel officially positions Workflow for stateful,
multi-step orchestration and Queues as its lower-level at-least-once primitive.
The authenticated `prad7` Hobby dashboard exposes Workflow onboarding.

## Proposed decision

Use Vercel Workflow for orchestration while retaining Postgres as business truth
and a transactional outbox/dispatch record around consequential work. Workflow
step retries do not replace payment idempotency or database uniqueness.

## Required spike

- Start a workflow only after a committed run/outbox record.
- Pause on a human-approval hook, close the browser, and resume.
- Deploy a compatible change while a workflow is suspended and document version behavior.
- Crash after database commit but before dispatch acknowledgement; recover once.
- Receive an external callback and wake or reconcile the correct run.
- Demonstrate retry behavior, terminal errors, observability, retention, limits,
  environment isolation, and cost on the actual Hobby team.

## Consequences

If the spike fails a hard requirement or acceptable cost/limits cannot be set,
fall back to option 2 or 3 through a superseding ADR. A queue's approximate order
and at-least-once delivery always require idempotent consumers and server-assigned
per-run event sequence.
