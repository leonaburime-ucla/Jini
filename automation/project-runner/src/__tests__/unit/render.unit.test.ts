import { describe, expect, it } from 'vitest';
import { renderTasksMarkdown } from '../../render/render-tasks-md.js';
import { renderPipelineStateMarkdown } from '../../render/render-pipeline-state-md.js';
import type { WorkItem } from '../../domain/types.js';

function makeItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: 'm1-red-spec',
    dagId: 'extraction-plan-v1',
    planHash: 'sha256:abc',
    milestone: 1,
    taskType: 'red-spec',
    title: 'm1 red-spec: Harnesses + sync-ownership manifest',
    dependsOn: [],
    requiresApproval: false,
    state: 'queued',
    retryCount: 0,
    maxRetries: 3,
    approvedAt: null,
    approvedBy: null,
    nextAttemptEarliestAt: null,
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
    ...overrides,
  };
}

describe('renderTasksMarkdown', () => {
  it('groups WorkItems under a milestone heading and renders a checked box only for succeeded items', () => {
    const markdown = renderTasksMarkdown({
      dagId: 'extraction-plan-v1',
      planHash: 'sha256:abc',
      workItems: [
        makeItem({ id: 'm1-red-spec', state: 'succeeded' }),
        makeItem({ id: 'm1-impl', state: 'queued' }),
      ],
    });

    expect(markdown).toContain('## Milestone 1');
    expect(markdown).toContain('- [x] `m1-red-spec` — succeeded');
    expect(markdown).toContain('- [ ] `m1-impl` — queued');
  });

  it('is marked as a generated file so humans do not hand-edit it', () => {
    const markdown = renderTasksMarkdown({ dagId: 'd', planHash: 'h', workItems: [] });
    expect(markdown).toContain('GENERATED FILE');
  });
});

describe('renderPipelineStateMarkdown', () => {
  it('translates each WorkItemState into its AI-Dev-Shop canonical status', () => {
    const markdown = renderPipelineStateMarkdown({
      dagId: 'extraction-plan-v1',
      planHash: 'sha256:abc',
      renderedAt: '2026-07-16T00:00:00.000Z',
      workItems: [makeItem({ id: 'm1-impl', state: 'retry_scheduled' })],
    });
    expect(markdown).toContain('| `m1-impl` | 1 | red-spec | RETRYING |');
  });

  it('annotates a retry-exhausted failed item as ESCALATED', () => {
    const markdown = renderPipelineStateMarkdown({
      dagId: 'd',
      planHash: 'h',
      renderedAt: '2026-07-16T00:00:00.000Z',
      workItems: [makeItem({ state: 'failed', retryCount: 3, maxRetries: 3 })],
    });
    expect(markdown).toContain('ESCALATED');
  });

  it('does not annotate a failed item that still has retry budget remaining', () => {
    const markdown = renderPipelineStateMarkdown({
      dagId: 'd',
      planHash: 'h',
      renderedAt: '2026-07-16T00:00:00.000Z',
      workItems: [makeItem({ state: 'failed', retryCount: 1, maxRetries: 3 })],
    });
    expect(markdown).not.toContain('ESCALATED');
  });

  it('lists non-terminal items under In-Flight / Blocked and settled items are excluded', () => {
    const markdown = renderPipelineStateMarkdown({
      dagId: 'd',
      planHash: 'h',
      renderedAt: '2026-07-16T00:00:00.000Z',
      workItems: [
        makeItem({ id: 'm1-red-spec', state: 'succeeded' }),
        makeItem({ id: 'm1-impl', state: 'waiting_for_human' }),
      ],
    });
    const inFlightSection = markdown.split('## In-Flight / Blocked')[1] ?? '';
    expect(inFlightSection).toContain('m1-impl');
    expect(inFlightSection).not.toContain('m1-red-spec');
  });
});
