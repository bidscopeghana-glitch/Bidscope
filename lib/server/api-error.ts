import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code = "request_failed") {
    super(message);
  }
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return Response.json(
      { error: "The request contains invalid data.", code: "validation_error", details: error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  console.error("Unhandled API error", error);
  return Response.json({ error: "An unexpected error occurred.", code: "internal_error" }, { status: 500 });
}

