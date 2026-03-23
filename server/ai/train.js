/**
 * Behavioural Cloning trainer
 *
 * Two-headed MLP:
 *   Shared trunk → Head A: formation classification (5 classes)
 *                → Head B: target position regression (2 values)
 *
 * Usage:
 *   node server/ai/train.js
 *   node server/ai/train.js --epochs 50 --lr 0.001
 */

import * as tf from '@tensorflow/tfjs-node';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { prepareBatch, FORMATIONS, FEATURE_SIZE } from './preprocess.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const SAMPLES_FILE = join(__dir, '..', 'data', 'samples.json');
const MODEL_DIR = join(__dir, '..', 'model');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag, def) => {
  const i = args.indexOf(flag);
  return i !== -1 ? parseFloat(args[i + 1]) : def;
};
const EPOCHS = getArg('--epochs', 40);
const LR     = getArg('--lr', 0.002);
const BATCH  = getArg('--batch', 32);

// ── Load data ─────────────────────────────────────────────────────────────────
function loadSamples() {
  if (!existsSync(SAMPLES_FILE)) {
    console.error('No samples file found. Play the game first to collect data.');
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(SAMPLES_FILE, 'utf8'));
  console.log(`Loaded ${raw.length} raw samples`);

  const { xs, formLabels, xyLabels, count } = prepareBatch(raw);
  if (count < 10) {
    console.error(`Only ${count} usable samples. Need at least 10 to train.`);
    process.exit(1);
  }
  console.log(`Preprocessed: ${count} usable samples`);
  return { xs, formLabels, xyLabels };
}

// ── Model ─────────────────────────────────────────────────────────────────────
function buildModel() {
  const input = tf.input({ shape: [FEATURE_SIZE] });

  // shared trunk
  let x = tf.layers.dense({ units: 64, activation: 'relu',
    kernelInitializer: 'glorotUniform' }).apply(input);
  x = tf.layers.dropout({ rate: 0.2 }).apply(x);
  x = tf.layers.dense({ units: 64, activation: 'relu' }).apply(x);
  x = tf.layers.dropout({ rate: 0.2 }).apply(x);
  x = tf.layers.dense({ units: 32, activation: 'relu' }).apply(x);

  // head A — formation (classification)
  const formHead = tf.layers.dense({
    units: FORMATIONS.length,
    activation: 'softmax',
    name: 'formation',
  }).apply(x);

  // head B — target position (regression, sigmoid for [0,1])
  const posHead = tf.layers.dense({
    units: 2,
    activation: 'sigmoid',
    name: 'position',
  }).apply(x);

  return tf.model({ inputs: input, outputs: [formHead, posHead] });
}

// ── Train ─────────────────────────────────────────────────────────────────────
async function train() {
  console.log(`\n  SwarmCommand — Behavioural Cloning`);
  console.log(`  Epochs: ${EPOCHS}  LR: ${LR}  Batch: ${BATCH}\n`);

  const { xs, formLabels, xyLabels } = loadSamples();
  const n = xs.length;

  const xTensor = tf.tensor2d(xs);
  const formTensor = tf.oneHot(tf.tensor1d(formLabels, 'int32'), FORMATIONS.length).toFloat();
  const posTensor = tf.tensor2d(xyLabels);

  const model = buildModel();
  model.compile({
    optimizer: tf.train.adam(LR),
    loss: { formation: 'categoricalCrossentropy', position: 'meanSquaredError' },
    lossWeights: { formation: 1.0, position: 2.0 },
    metrics: { formation: 'accuracy' },
  });

  model.summary();

  // 80/20 split
  const splitIdx = Math.floor(n * 0.8);
  const xTrain = xTensor.slice([0, 0], [splitIdx, -1]);
  const xVal   = xTensor.slice([splitIdx, 0], [-1, -1]);
  const fTrain = formTensor.slice([0, 0], [splitIdx, -1]);
  const fVal   = formTensor.slice([splitIdx, 0], [-1, -1]);
  const pTrain = posTensor.slice([0, 0], [splitIdx, -1]);
  const pVal   = posTensor.slice([splitIdx, 0], [-1, -1]);

  await model.fit([xTrain], [fTrain, pTrain], {
    epochs: EPOCHS,
    batchSize: BATCH,
    validationData: [[xVal], [fVal, pVal]],
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        if ((epoch + 1) % 5 === 0 || epoch === 0) {
          const acc = (logs.formation_acc ?? logs.formation_accuracy ?? 0);
          const loss = (logs.loss ?? 0);
          const valAcc = (logs.val_formation_acc ?? logs.val_formation_accuracy ?? 0);
          console.log(
            `  Epoch ${String(epoch + 1).padStart(3)} / ${EPOCHS}` +
            `  loss: ${loss.toFixed(4)}` +
            `  form_acc: ${(acc * 100).toFixed(1)}%` +
            `  val_acc: ${(valAcc * 100).toFixed(1)}%`
          );
        }
      },
    },
  });

  // Save
  if (!existsSync(MODEL_DIR)) mkdirSync(MODEL_DIR, { recursive: true });
  const savePath = `file://${MODEL_DIR}`;
  await model.save(savePath);
  console.log(`\n  Model saved → ${MODEL_DIR}`);
  console.log(`  Restart the server to serve the updated model.\n`);

  // Cleanup tensors
  [xTensor, formTensor, posTensor, xTrain, xVal, fTrain, fVal, pTrain, pVal].forEach(t => t.dispose());
  model.dispose();
}

train().catch(console.error);
