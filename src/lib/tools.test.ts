import { describe, expect, it } from "vitest";
import { executeSupportTool } from "./tools";

const user = { role: "user" as const, content: "My account is lucas.moreau@atelier-moreau.fr" };

describe("support tool simulator", () => {
  it("returns a subscription from the official example fixtures", () => {
    const result = executeSupportTool("get_subscription", { email: "lucas.moreau@atelier-moreau.fr" }, [user]);
    expect(result).toMatchObject({ email: "lucas.moreau@atelier-moreau.fr" });
    expect((result as { invoices: { invoice_id: string }[] }).invoices[0].invoice_id).toBe("INV-203488");
  });
  it("rejects unknown accounts and malformed arguments", () => {
    expect(() => executeSupportTool("get_subscription", { email: "nobody@example.com" }, [user])).toThrow("No mock account");
    expect(() => executeSupportTool("get_subscription", { email: "bad", extra: true }, [user])).toThrow("Invalid get_subscription arguments");
  });
  it("requires a lookup and known invoice before a simulated case", () => {
    const args = { email: "lucas.moreau@atelier-moreau.fr", invoice_id: "INV-203488", case_type: "refund", amount: 24, description: "Charge after cancellation." };
    expect(() => executeSupportTool("open_billing_case", args, [user])).toThrow("Look up the subscription");
    const result = executeSupportTool("get_subscription", { email: args.email }, [user]);
    const history = [user, { role: "tool" as const, tool_call_id: "lookup", content: JSON.stringify(result) }];
    expect(executeSupportTool("open_billing_case", args, history)).toMatchObject({ status: "simulated", invoice_id: "INV-203488" });
    expect(() => executeSupportTool("open_billing_case", { ...args, invoice_id: "INV-999999" }, history)).toThrow("does not belong");
  });
  it("does not simulate reset for an unconfirmed email", () => {
    expect(() => executeSupportTool("send_password_reset", { email: "lucas.moreau@atelier-moreau.fr" }, [{ role: "user", content: "I forgot my password" }])).toThrow("confirm");
  });
});
