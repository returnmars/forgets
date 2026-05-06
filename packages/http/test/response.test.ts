import { describe, expect, it } from "vitest";
import { HttpError, normalizeResponse } from "../src/index";

describe("response normalization", () => {
  it("maps undefined to 204", () => {
    expect(normalizeResponse(undefined)).toEqual({
      status: 204,
      headers: {},
      body: undefined,
    });
  });

  it("maps objects to JSON", () => {
    expect(normalizeResponse({ ok: true })).toEqual({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true }),
    });
  });

  it("maps null to JSON null", () => {
    expect(normalizeResponse(null)).toEqual({
      status: 200,
      headers: { "content-type": "application/json" },
      body: "null",
    });
  });

  it("maps ResponseBuilder to explicit status, headers, and JSON body", () => {
    expect(
      normalizeResponse({
        statusCode: 201,
        headers: { "x-mode": "native" },
        body: { created: true },
      }),
    ).toEqual({
      status: 201,
      headers: {
        "content-type": "application/json",
        "x-mode": "native",
      },
      body: JSON.stringify({ created: true }),
    });
  });

  it("maps HttpError to structured error body", () => {
    const response = normalizeResponse(
      HttpError.notFound("Missing", { code: "MISSING" }),
    );

    expect(response.status).toBe(404);
    expect(JSON.parse(String(response.body))).toEqual({
      error: {
        code: "MISSING",
        message: "Missing",
        status: 404,
      },
    });
  });

  it("maps HttpError-shaped values to structured error body", () => {
    const response = normalizeResponse({
      name: "HttpError",
      status: 500,
      code: "FORGETS_INTERNAL_ERROR",
      message: "Internal Server Error",
    });

    expect(response.status).toBe(500);
    expect(JSON.parse(String(response.body))).toEqual({
      error: {
        code: "FORGETS_INTERNAL_ERROR",
        message: "Internal Server Error",
        status: 500,
      },
    });
  });
});
