# Anthropic Guardrail Notes

Source:
- https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations

This note captures the parts most applicable to repo and pipeline harnessing.

## Core Takeaways

### Allow Uncertainty

Agents should be allowed to say they do not know rather than being pushed toward confident fabrication.

### Require Grounding

High-stakes factual claims should point back to source artifacts, quotes, file references, or verified outputs.

### Use Source Restrictions Deliberately

When a task should use only the provided files or approved artifacts, the instructions should say so explicitly.

### Verify Long-Context Synthesis

For long documents or large code surfaces, agents should extract the relevant facts before synthesizing conclusions.

## Direct Implications For AI Dev Shop

- keep evidence-over-invention as a global rule
- require concrete artifact references in reviews and findings
- make source-restricted tasks explicit
- prefer verification passes before final high-impact summaries

This complements harness engineering by reducing false confidence inside the feedback loop.
