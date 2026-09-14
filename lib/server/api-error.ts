import { ZodError } from "zod";

export class ApiError extends Error {
  public status: number;
  public code: string;
  constructor(status: number, message: string, code = "request_failed") {
    super(message);
    this.status = status;
    this.code = code;
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
