import { describe, expect, it } from "vitest";
import { parseReceiptQr } from "./receipt-qr";

describe("parseReceiptQr", () => {
  it("reads amount and date from a fiscal receipt QR", () => {
    expect(parseReceiptQr("t=20261121T1530&s=857.40&fn=9287440300&i=12&fp=345&n=1")).toEqual({
      amount: 857,
      date: "2026-11-21",
    });
  });
  it("ignores QR codes that are not receipts", () => {
    expect(parseReceiptQr("https://example.com")).toBeNull();
  });
});
