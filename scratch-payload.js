const getAgentPrompt = require('./scratch-prompt.js');
const fs = require('fs');

const dir = 'C:\\Users\\hamed\\Desktop\\hisabche\\llm-council-results\\2026-10-06_19-06-20';

const m1 = `Assume something important is wrong. Actively search for architectural flaws, hidden failure modes, sync inconsistencies, data integrity risks, and "looks finished but is not finished" areas. Specifically try to disprove optimistic project claims. Search for contradictions.
Your output MUST answer:
1. What is most likely to fail?
2. What is the most dangerous hidden assumption?
3. What looks more complete than it really is?
4. What could cause expensive future rework?
5. What should NOT be built yet?
6. What is your strongest evidence?
7. What would make you change your conclusion?
Be aggressive but evidence-based.`;

const m2 = `Ignore superficial implementation details initially. "What problem is this system fundamentally trying to solve?" Reconstruct the architecture from first principles. Evaluate domain boundaries, source of truth, offline/local-first architecture, sync model, event flow, consistency guarantees. Determine whether the current architecture actually follows the product's fundamental requirements. Look especially for architectural principles that are stated but not enforced.
Answer:
1. What architecture is the project actually implementing?
2. What architecture should exist from first principles?
3. Where do those differ?
4. Which architectural decisions are excellent?
5. Which decisions will become expensive later?
6. Which abstraction is missing?
7. What is the smallest architectural correction with the highest leverage?`;

const m3 = `Look for upside that the current project may be underestimating. Evaluate product potential, ecosystem potential, workflow expansion, scalability. Stay grounded in the actual architecture and existing product. Do NOT invent arbitrary startup ideas. Identify opportunities already latent inside the current system.
Answer:
1. What is the biggest upside?
2. What existing architecture enables that upside?
3. Which capability has disproportionate strategic leverage?
4. Which opportunity should be deliberately ignored?
5. What could become a moat?
6. What should be built after the current foundation is solid?
7. What is the highest-value expansion path?`;

const m4 = `Pretend you discovered this project for the first time. Do NOT assume the founders' mental model. Evaluate the project as an outsider: Is the purpose obvious? Are concepts understandable? Is the UX consistent? Is the system over-engineered? What would confuse a new operator, accountant, or developer? Inspect actual UI/code/API structures where relevant. Pay special attention to onboarding, empty states, error states, offline states, responsive behavior.
Answer:
1. What is obvious?
2. What is confusing?
3. What is unnecessarily complex?
4. What is missing from the user's mental model?
5. Where is the trust gap?
6. What would a new user likely misunderstand?
7. What single UX/product change would have the highest impact?`;

const m5 = `Treat every proposal as something that must actually ship. Evaluate implementation maturity, code quality, testability, deployment, observability, migration complexity, developer ergonomics. For every major recommendation, ask: "Can this actually be implemented in this repository without creating a second system?" Determine what is ready, what is almost ready, what requires foundational work.
Answer:
1. What can ship now?
2. What is not production-ready?
3. What is the biggest implementation bottleneck?
4. Which technical debt blocks progress?
5. What should happen first?
6. What is the shortest safe path to materially improve the project?
7. What should explicitly NOT be touched yet?`;

const payload = [
  { TypeName: 'self', Model: 'pro', Role: 'Contrarian / Failure Hunter', Prompt: getAgentPrompt(m1, dir + '\\02-agent-contrarian.md') },
  { TypeName: 'self', Model: 'pro', Role: 'First Principles / Architecture', Prompt: getAgentPrompt(m2, dir + '\\03-agent-first-principles.md') },
  { TypeName: 'self', Model: 'pro', Role: 'Expansionist / Product + Scale', Prompt: getAgentPrompt(m3, dir + '\\04-agent-expansionist.md') },
  { TypeName: 'self', Model: 'pro', Role: 'Outsider / User + Simplicity + Reality', Prompt: getAgentPrompt(m4, dir + '\\05-agent-outsider.md') },
  { TypeName: 'self', Model: 'pro', Role: 'Executor / Production Engineer', Prompt: getAgentPrompt(m5, dir + '\\06-agent-executor.md') }
];

fs.writeFileSync('payload.json', JSON.stringify(payload, null, 2));
