import fs from "fs";
import csvParser from "csv-parser";
import { createObjectCsvWriter } from "csv-writer";

const predictionCSV ="terminal_output.csv.csv";         //The LLM generated csv with  labels
const groundTruthCSV = "Keras_Original_Dataset.csv";    // Original labeled dataset(ground truth)
const evaluationOutputCSV = "evaluation_results.csv";   // evaluation output

const validLabels = {
  "Level 1 (Central Contract Category)": ["SAM", "Hybr  id", "AMO"],
  "Level 2": ["BET", "F", "SL", "DT", "G", "SAI"],
  "Level 3 (Hybrid Patterns)": ["IC-1", "IC-2", "PT", "BIT", "RT", "MT", "F", "G"],
  "Leaf Contract Category": [
    "IC-1", "IC-2", "PT", "BIT", "RT", "MT", "F", "G",
    "AMO(Level-2)", "SAM(Level-3)", "Comb. of SAM(Level 3) and AMO(Level 2)"
  ],
  "Root Cause": [
    "Unacceptable Input Type", "Unacceptable Input Value", "Missing Options",
    "Missing Required Method Order", "Missing Required State-specific Method Order",
    "Missing Input value-Method order Dependency", "Missing Input Value/Type Dependency"
  ],
  "Effect": ["Crash", "IF", "BP", "MOB", "Unknown"],
  "Contract Violation Location": [
    "Model Construction", "Train", "Model Evaluation", "Data Preprocessing",
    "Prediction", "Load", "Model Initialization"
  ],
  "Detection Technique": ["Static", "Runtime Checking"]
};

function cleanLabel(label) {
  return label
    .replace(/^\*+|\*+$/g, "")  // removes asterisks from start and end
    .replace(/\(.*?\)/g, "")    // removes (Selection)
    .trim();
}



function normalizeLabel(label, validLabels, isMultiLabel = false) {
  if (!label || typeof label !== "string") return isMultiLabel ? [] : "No Label";

  const cleaned = cleanLabel(label);
  if (cleaned === "0" || cleaned === "") return isMultiLabel ? [] : "No Label";

  if (isMultiLabel) {
    return cleaned
      .split(/,|\//)
      .map(t => cleanLabel(t))
      .filter(v => validLabels.includes(v))
      .sort();
  } else {
    for (const v of validLabels) {
      if (cleanLabel(cleaned).toLowerCase() === v.toLowerCase()) return v;
    }
    return "No Label";
  }
}

async function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on("data", row => rows.push(row))
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
}

function getSingleLabelMetrics(trueLabels, predLabels) {
  let tp = 0, fp = 0, fn = 0;
  let validCount = 0;

  for (let i = 0; i < trueLabels.length; i++) {
    const trueLabel = trueLabels[i];
    const predLabel = predLabels[i];

    if (trueLabel === "No Label" && predLabel === "No Label") continue;

    validCount++;

    if (trueLabel === predLabel) {
      tp++;
    } else {
      if (predLabel !== "No Label") fp++;
      if (trueLabel !== "No Label") fn++;
    }
  }

  console.log(`Evaluated rows for single-label column: ${validCount}`);

  const accuracy = tp / validCount;
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  return { accuracy, precision, recall, f1 };
}

function getMultiLabelMetrics(trueLabelsArray, predLabelsArray) {
  let tp = 0, fp = 0, fn = 0, correct = 0;

  const total = trueLabelsArray.length;
  console.log(`Evaluated rows for multi-label column: ${total}`);

  for (let i = 0; i < total; i++) {
    const trueLabels = new Set(trueLabelsArray[i]);
    const predLabels = new Set(predLabelsArray[i]);

    const trueSorted = [...trueLabels].sort();
    const predSorted = [...predLabels].sort();

    if (JSON.stringify(trueSorted) === JSON.stringify(predSorted)) {
      correct++;
    }

    trueLabels.forEach(label => {
      if (predLabels.has(label)) tp++;
      else fn++;
    });

    predLabels.forEach(label => {
      if (!trueLabels.has(label)) fp++;
    });
  }

  const accuracy = correct / total;
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  return { accuracy, precision, recall, f1 };
}

function mergeOnPostURL(predData, trueData) {
  const normalizeURL = url => (url || "").trim().toLowerCase();

  const trueMap = Object.fromEntries(
    trueData.map(row => [normalizeURL(row["SO Post URL"]), row])
  );

  const merged = predData
    .filter(row => normalizeURL(row["SO Post URL"]) in trueMap)
    .map(row => ({
      pred: row,
      true: trueMap[normalizeURL(row["SO Post URL"])]
    }));

  console.log("Evaluating predictions for", merged.length, "/", predData.length, "posts.");
  return merged;
}


async function evaluateColumns(predFile, trueFile) {
  const predData = await readCSV(predFile);
  const trueData = await readCSV(trueFile);
  const merged = mergeOnPostURL(predData, trueData);

  const results = [];

  for (const col in validLabels) {
    console.log(`Evaluating: ${col}`);

    const isMulti = col === "Level 3 (Hybrid Patterns)";
    const trueLabels = merged.map(pair => normalizeLabel(pair.true[col] || "", validLabels[col], isMulti));
    const predLabels = merged.map(pair => normalizeLabel(pair.pred[col] || "", validLabels[col], isMulti));

    const metrics = isMulti
      ? getMultiLabelMetrics(trueLabels, predLabels)
      : getSingleLabelMetrics(trueLabels, predLabels);

    results.push({ column: col, ...metrics });
    console.log(`${col}:`, metrics);
  }

  return results;
}

async function main() {
  console.log("Running Evaluation...");
  try {
    const evalResults = await evaluateColumns(predictionCSV, groundTruthCSV);
    const csvWriterEval = createObjectCsvWriter({
      path: evaluationOutputCSV,
      header: Object.keys(evalResults[0]).map(key => ({ id: key, title: key }))
    });

    await csvWriterEval.writeRecords(evalResults);
    console.log("Results saved to:", evaluationOutputCSV);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
