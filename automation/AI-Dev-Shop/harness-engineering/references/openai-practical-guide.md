# OpenAI Practical Agent Guide Notes

Source:
- https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf

This is a local distillation of the parts that matter most for repo harness design.

## Agent Design Foundations

Every agent system needs three core components:

- model
- tools
- instructions

Harness engineering improves the last two by making tools reliable and instructions explicit.

## Tool Design Implications

- tools should be standardized and reusable
- well-documented tools improve discoverability
- agents need data tools, action tools, and orchestration tools

For this repo, that translates into reusable validators, benchmark runners, and maintenance scripts.

## Instruction Design Implications

- start from existing operating procedures and convert them into LLM-friendly routines
- break dense rules into smaller, explicit steps
- define clear actions and edge-case handling

For this repo, that means turning workflow prose into smaller linked artifacts and eventually into checks.

## Guardrails As Layered Defense

The guide treats guardrails as layered, specialized protections rather than one catch-all rule. Useful categories include:

- relevance checks
- safety and injection checks
- PII filtering
- moderation
- tool safeguards
- rules-based protections
- output validation

For this repo, the important lesson is structural: do not rely on one instruction file or one review stage to catch everything.

## Evals First, Then Optimization

Use evals to establish a baseline before optimizing for cost or speed. Applied here:

- benchmark agent behaviors before major skill changes
- keep rubrics fixed while tuning instructions
- treat quality regression as a first-class harness signal
