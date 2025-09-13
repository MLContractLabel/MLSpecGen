This is a reproducibility package for our MLSpecGen technique.
Files & Roles (brief)

1) Motivating_Example_Folder
   
-Motivating_ReadMe.txt- Instructions to run the motivating example.
-gpt_ragtestterminal.js/claude_ragtest_terminal.js
  Main runners. Fetches post, retrieves examples, calls GPT/Claude, parses <BUGGY_CODE> / <FIXED_CODE>, writes outputs.

-rcontext.txt — Short “paper context” injected into prompts.

-actionable_examples.txt — Patterns for concise actionable feedback.

-pycontracts_doc.txt / pycontracts_deep.txt — PyContracts quick-ref + deeper notes.

-kerasembedded_examples.json — Retrieval corpus with precomputed embeddings.

-terminal_ outputs* — Generated Python and a CSV summary for each run.

-metrics_final.js- Metrics Evaluation script

-Keras_Original_Dataset.csv- Ground truth labels of keras posts.

-BUGGY and FIXED pycontract files contain the refined contracts of the motivating example.

2) Data Preparation scripts

generateseen.js- Script which automatically creates seen examples.
filterunseen2-   Script which automatically creates unseen dataset.
embedder.js-     Script which creates ebeddings of seen and unseen posts.

