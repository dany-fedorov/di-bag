// A deterministic interoperability probe, not an agent-performance benchmark.
// Setup and limits: 2026-09-12-harness-engineering-claim-audit.md.
import assert from 'node:assert/strict';
import { DiBag } from 'di-bag/node';
import { defineException, toDiagnosticReport, toPublicReport } from 'application-exception';
import { END, MemorySaver, START, StateGraph, StateSchema } from '@langchain/langgraph';
import { z } from 'zod';

const State = new StateSchema({
  question: z.string(),
  answer: z.string().default(''),
  attempts: z.number().default(0),
  outcome: z.enum(['pending', 'retry', 'done', 'fallback']).default('pending'),
  code: z.string().default(''),
});
type GraphState = typeof State.State;
type Node = (state: GraphState) => Promise<Partial<GraphState>>;
type Model = { complete(question: string): Promise<string>; close(): void };
type Records = ReturnType<typeof toDiagnosticReport>[];
type Scenario = 'success' | 'retry' | 'exhausted' | 'unexpected';
type Counts = { created: number; calls: number; closed: number };

const Unavailable = defineException({
  tag: 'model/Unavailable',
  message: ({ endpoint }: { endpoint: string }) => `Unavailable: ${endpoint}`,
});

function createModel(scenario: Scenario, counts: Counts): Model {
  counts.created++;
  return {
    async complete(question) {
      counts.calls++;
      if (scenario === 'unexpected') throw new Error('Unexpected fixture error');
      if (scenario === 'exhausted' || (scenario === 'retry' && counts.calls === 1)) {
        throw new Unavailable({ details: { endpoint: 'fixture' } });
      }
      return `Answer: ${question}`;
    },
    close() { counts.closed++; },
  };
}

function createAnswerNode({ model, records }: { model: Model; records: Records }): Node {
  return async state => {
    const attempts = state.attempts + 1;
    try {
      return { attempts, answer: await model.complete(state.question), outcome: 'done', code: '' };
    } catch (caught: unknown) {
      const diagnostic = toDiagnosticReport(caught, {
        context: { node: 'respond', attempt: attempts },
        limits: { maxBytes: 4096 },
      });
      records.push(diagnostic);
      const known = caught instanceof Unavailable;
      const publicReport = toPublicReport(diagnostic.reference, known ? {
        code: 'MODEL_UNAVAILABLE', message: 'Model temporarily unavailable.',
      } : undefined);
      // This fixture operation has no external mutations. This rule is not a
      // general retry-safety guarantee, and real LLM retries may incur cost.
      return { attempts, code: publicReport.code, outcome: known && attempts < 2 ? 'retry' : 'fallback' };
    }
  };
}

function compile(node: Node) {
  return new StateGraph(State)
    .addNode('respond', node)
    .addEdge(START, 'respond')
    .addConditionalEdges('respond', state => state.outcome === 'retry' ? 'respond' : END)
    .compile({ checkpointer: new MemorySaver() });
}

async function execute(node: Node, scenario: Scenario, records: Records) {
  const graph = compile(node);
  const config = { configurable: { thread_id: `fixture-${scenario}` } };
  const result = await graph.invoke({ question: 'hello' }, config);
  const saved = await graph.getState(config);
  assert.deepEqual(saved.values, result);
  // Only data enters checkpoints, not bags, providers, errors, or clients.
  assert.deepEqual(JSON.parse(JSON.stringify(saved.values)), result);
  assert.equal(result.attempts, scenario === 'retry' || scenario === 'exhausted' ? 2 : 1);
  assert.equal(result.outcome, scenario === 'success' || scenario === 'retry' ? 'done' : 'fallback');
  assert.equal(records.length, scenario === 'success' ? 0 : scenario === 'exhausted' ? 2 : 1);
  if (scenario === 'unexpected') assert.equal(result.code, 'INTERNAL_ERROR');
  return result;
}

const answerModule = DiBag.createBuilder().register({ answer: createAnswerNode }).buildModule(['answer']);
const fixture = DiBag.createBuilder().installModule(answerModule).register({
  model: (): Model => { throw new Error('A trial must replace this provider'); },
  records: (): Records => [],
}).build();

try {
  for (const scenario of ['success', 'retry', 'exhausted', 'unexpected'] as const) {
    const injected: Counts = { created: 0, calls: 0, closed: 0 };
    const bag = fixture.fork(['model'], {
      model: DiBag.withDisposal(() => createModel(scenario, injected), model => model.close()),
    });
    let viaBag: GraphState;
    try {
      const node = bag.resolve('answer');
      assert.equal(bag.resolve('answer'), node);
      viaBag = await execute(node, scenario, bag.resolve('records'));
      assert.equal(injected.created, 1);
      assert.equal(injected.closed, 0);
    } finally {
      // Await graph work before closing resources; the bag does not do this.
      await bag.close();
    }
    assert.equal(injected.closed, 1);

    const manual: Counts = { created: 0, calls: 0, closed: 0 };
    const model = createModel(scenario, manual);
    const manualRecords: Records = [];
    let directly: GraphState;
    try {
      directly = await execute(createAnswerNode({ model, records: manualRecords }), scenario, manualRecords);
    } finally {
      model.close();
    }
    assert.deepEqual(directly, viaBag);
    assert.deepEqual(manual, injected);
    console.log(`${scenario}: same graph result; ${injected.created} client, ${injected.calls} calls, ${injected.closed} cleanup`);
  }
} finally {
  await fixture.close();
}
