// embed_seen_examples_full.js
import fs from "fs";
import csvParser from "csv-parser";
import axios from "axios";

const MODEL = "nomic-embed-text";
const INPUT_CSV = "keras_seen.csv";              // <-- your labeled “seen” CSV
const OUTPUT_JSON = "kerasembedded_examples.json";     // <-- what your pipeline loads

function htmlToMarkdown(html) {
  let s = (html || "").toString();
  s = s.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/gi, (_m, code) =>
    `\n\`\`\`python\n${code.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&")}\n\`\`\`\n`);
  s = s.replace(/<code>(.*?)<\/code>/gi, (_m, code) =>
    "`" + code.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&") + "`");
  s = s.replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, (_m, href, text) => `[${text}](${href})`);
  s = s.replace(/<img [^>]*alt="([^"]*)"[^>]*src="([^"]+)"[^>]*\/?>/gi, (_m, alt, src) => `![${alt}](${src})`);
  s = s.replace(/<p>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

function pick(row, names) { for (const n of names) if (row[n] != null && row[n] !== "") return row[n]; return ""; }

async function readCSV(file) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(file).pipe(csvParser())
      .on("data", r => rows.push(r)).on("end", () => resolve(rows)).on("error", reject);
  });
}

async function getEmbedding(text) {
  const resp = await axios.post("http://127.0.0.1:11434/api/embeddings",
                                { model: MODEL, input: text }, { timeout: 15000 });
  const b = resp.data;
  if (Array.isArray(b?.data) && b.data[0]?.embedding) return b.data[0].embedding;
  if (Array.isArray(b?.embedding)) return b.embedding;
  throw new Error("Unexpected Ollama embeddings response.");
}

function buildInputText({ api, title, question, answer }) {
  return [
    api ? `ML API Name: ${api}` : "",
    title ? `Title: ${title}` : "",
    "Question:", (question || "").trim(), "", "Answer:", (answer || "").trim()
  ].join("\n").trim();
}

(async () => {
  const rows = await readCSV(INPUT_CSV);
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const postURL = pick(row, ["SO Post URL","so_post_url","url","Post URL"]);
    const title = pick(row, ["Title","title"]);
    const api = pick(row, ["ML API Name","ml_api_name","API","api"]);
    const question = htmlToMarkdown(pick(row, ["Question","question","question_html"]));
    const answer = htmlToMarkdown(pick(row, ["Answer","answer","answer_html"]));

    const inputText = buildInputText({ api, title, question, answer });
    const embedding = await getEmbedding(inputText);

    out.push({
      postURL, title, question, answer, mlApiName: api, embedding,
      label: {
        level1: pick(row, ["Level 1 (Central Contract Category)","level1","Level 1"]),
        level2: pick(row, ["Level 2","level2"]),
        level3: pick(row, ["Level 3 (Hybrid Patterns)","level3","Level 3"]),
        leafContractCategory: pick(row, ["Leaf Contract Category","leafContractCategory"]) || pick(row, ["Level 3 (Hybrid Patterns)","level3","Level 3"]),
        rootCause: pick(row, ["Root Cause","rootCause"]),
        effect: pick(row, ["Effect","effect"]),
        mlLibrary: pick(row, ["ML Library","mlLibrary"]),
        contractViolationLocation: pick(row, ["Contract Violation Location","contractViolationLocation"]),
        detectionTechnique: pick(row, ["Detection Technique","detectionTechnique"]),
        reasonsForNotLabeling: pick(row, ["Reasons for not labelling","reasonsForNotLabeling"]) || "NA",
        reasonsForLabeling: pick(row, ["Reasons for labeling","reasonsForLabeling"])
      }
    });

    console.log(`✅ ${i+1}/${rows.length} embedded ${postURL || title || ""}`);
  }
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(out, null, 2));
  console.log(`\nSaved ${out.length} examples to ${OUTPUT_JSON}`);
})();
