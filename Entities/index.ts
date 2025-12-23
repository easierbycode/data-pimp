// Entity type exports for Deno Deploy compatibility
// These types are derived from the JSON schemas in this directory

export type { Sample, Bundle, InventoryTransaction } from "../api/base44Client.ts";

// Re-export the entity schemas for runtime validation if needed
import SampleSchema from "./Sample.json" with { type: "json" };
import BundleSchema from "./Bundle.json" with { type: "json" };
import InventoryTransactionSchema from "./InventoryTransaction.json" with { type: "json" };

export const schemas = {
  Sample: SampleSchema,
  Bundle: BundleSchema,
  InventoryTransaction: InventoryTransactionSchema,
};

// Status type for samples
export type SampleStatus = "available" | "checked_out" | "reserved" | "discontinued";

// Transaction action types
export type TransactionAction = "checkout" | "checkin" | "reserve" | "unreserve";

// Helper function to validate sample status
export function isValidSampleStatus(status: string): status is SampleStatus {
  return ["available", "checked_out", "reserved", "discontinued"].includes(status);
}

// Helper function to validate transaction action
export function isValidTransactionAction(action: string): action is TransactionAction {
  return ["checkout", "checkin", "reserve", "unreserve"].includes(action);
}

export default schemas;
