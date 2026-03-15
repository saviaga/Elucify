export const SECTION_PROMPTS: Record<string, string> = {
  paper: `You are given the full text of an academic paper. Write a concise, insightful research brief for someone who has never read this paper — like a knowledgeable colleague briefing them before a meeting.

Do NOT list the title, authors, affiliations, or publication year. Those are shown elsewhere.

Structure your brief with these sections:

## What is this paper about?
2–3 sentences in plain language. What is the core topic and why does it exist?

## The Problem It Solves
What specific gap, challenge, or open question does this paper address? Why did it need to be written?

## Core Contribution
What is the main thing this paper introduces, proposes, or proves? (A new model, framework, algorithm, dataset, analysis, theorem, etc.)

## How They Did It
The methodology in 3–5 bullet points. What approach, tools, datasets, or techniques did the authors use?

## Key Findings
The 3–5 most important results or conclusions.

## Why It Matters
The broader significance. Who benefits from this work and how? What does it unlock or enable?

## Research Area & Keywords
One line naming the field(s), followed by 5–8 keyword tags in backticks.

Write in clear, direct prose. Avoid jargon where possible. Do not copy-paste from the abstract.`,

  summary: `You are given the full text of an academic paper. Produce a comprehensive, detailed summary that a researcher could use as a complete substitute for reading the paper.

---

## Abstract

Quote the paper's abstract **verbatim**, exactly as written. Do not paraphrase.

---

## Key Takeaways

A bulleted list of 5–8 of the most important insights, contributions, or findings from the entire paper. Be specific and technical — avoid vague generalities.

---

## Full Paper Summary

Now write a thorough section-by-section breakdown of the paper. For each section:

- Use the **exact section title** from the paper as a markdown heading (##)
- Write 2–4 substantial paragraphs covering all important ideas, arguments, methods, and results in that section
- If the section introduces a figure, table, algorithm, or diagram, describe it explicitly: what it shows, what it illustrates, and why it matters (e.g. "Figure 1 shows the data flow through the MoE layer, illustrating how tokens are dispatched to experts via the router.")
- Include specific technical details: numbers, metrics, named components, architectural choices, baselines compared, datasets used
- Do NOT skip any section — cover Introduction, Related Work, Methodology, Experiments, Results, Discussion, Limitations, Conclusion, and any other sections present

Be thorough. This summary should be long and detailed. The goal is full comprehension of the paper without reading it.`,

  "conceptual-simplification": `Rewrite the paper in simplified language similar to a community-explained research summary.

Explain key ideas in plain language while preserving technical accuracy.
Clarify motivations, assumptions, and implications.
Use markdown formatting with clear section headers.`,

  glossary: `Generate an alphabetical list of advanced domain-specific terms from this paper that might not be known to an undergraduate computer science student.

For each term provide:
- **The term** in bold
- A short definition
- A verbatim quote from the paper showing how the term is used

Format as a clean markdown list.`,

  "knowledge-gaps": `Identify unresolved problems and unanswered questions in the paper.

Focus on:
- Limitations of the method
- Knowledge gaps
- Assumptions that might not hold in real world settings
- Areas where further research is needed

Write each as a bullet point with a brief explanation.`,

  "open-problems": `Identify open problems and future research directions suggested by or related to this paper.

For each problem:
- State the problem clearly
- Explain why it matters
- Describe what approaches might work

Format as numbered items with markdown.`,

  "continue-learning": `Identify important concepts someone should study to better understand the paper.

For each concept include:
- **Topic name**
- Short explanation of why it is relevant to understanding this paper
- Suggested starting point for learning

Focus on foundational ideas or prerequisite knowledge. Format as a markdown list.`,

  collections: `Categorize the paper into research topics.

Examples of categories:
- Machine Learning
- Computer Vision
- Natural Language Processing
- AI Safety
- Multimodal Models
- Reinforcement Learning
- Robotics

Return the most relevant categories and explain briefly why the paper fits each one. Format as a markdown list.`,

};

export const SECTION_LABELS: Record<string, string> = {
  paper: "Paper",
  summary: "Summary",
  "conceptual-simplification": "Conceptual Simplification",
  glossary: "Glossary",
  "knowledge-gaps": "Knowledge Gaps",
  "open-problems": "Open Problems",
  "continue-learning": "Continue Learning",
  collections: "Collections",
};

export const ALL_SECTION_KEYS = Object.keys(SECTION_PROMPTS);
