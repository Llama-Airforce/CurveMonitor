import { TransactionData } from "../../../../models/Transactions.js";
import { fetchTransactionsBatch, getTotalTransactionsCount } from "../../readFunctions/Transactions.js";
import { addAddressesForLabeling, enrichCandidateWithCoinInfo, removeProcessedTransactions } from "./SandwichUtils.js";
import { screenCandidate } from "./SandwichCandidateScreening.js";
import { displayProgressBar, updateConsoleOutput } from "../../../helperFunctions/QualityOfLifeStuff.js";

/**
 * Explanation for the term "Candidate":
 * A Candidate is basically an array of transactions.
 * These tx occured in the same pool in the same block.
 * Requirment is at least 2 tx, otherwise there is no possibilty for a sandwich.
 *
 * This Array is considered a Candidate for a Sandwich, and will then get screened for mev.
 */

// queries the db, and runs the parsed tx in batches through the detection process.
async function detectSandwichesInAllTransactions(): Promise<void> {
  let totalTransactionsCount = await getTotalTransactionsCount();
  const BATCH_SIZE = 10000;
  let offset = 0;

  while (true) {
    // displayProgressBar("Sandwich-Detection", offset, BATCH_SIZE * Math.ceil(totalTransactionsCount / BATCH_SIZE));
    console.log("Sandwich-Detection", offset, BATCH_SIZE * Math.ceil(totalTransactionsCount / BATCH_SIZE));
    const transactions = await fetchTransactionsBatch(offset, BATCH_SIZE);

    if (transactions.length === 0) break;

    const filteredTransactions = await removeProcessedTransactions(transactions);
    await findCandidatesInBatch(filteredTransactions);

    offset += BATCH_SIZE;
  }
}

// filters the batches for multiple tx in the same pool in the same block. Runs the filtered data further down the detection process.
export async function findCandidatesInBatch(batch: TransactionData[]): Promise<void> {
  const groups: { [key: string]: TransactionData[] } = {};

  // group transactions by `block_number` and `pool_id`
  for (const transaction of batch) {
    const key = `${transaction.block_number}-${transaction.pool_id}`;

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(transaction);
  }

  await searchInCandidatesClusterForSandwiches(groups);
}

// splits the array of "Candidates" to run them one by one further down the detection process.
async function searchInCandidatesClusterForSandwiches(groups: { [key: string]: TransactionData[] }): Promise<void> {
  for (const key in groups) {
    const candidate = groups[key];

    if (candidate.length > 1) {
      await scanCandidate(candidate);
    }
  }
}

// adding coin details
export async function scanCandidate(candidate: TransactionData[]): Promise<void> {
  let enrichedCandidate = await enrichCandidateWithCoinInfo(candidate);
  if (!enrichedCandidate) return;
  await screenCandidate(enrichedCandidate);
}

export async function updateSandwichDetection(): Promise<void> {
  await detectSandwichesInAllTransactions();
  await addAddressesForLabeling();
  updateConsoleOutput("[✓] Sandwich-Detection completed successfully.");
}