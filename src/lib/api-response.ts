import { NextResponse } from "next/server";

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json({ data, error: null }, { status });
}

export function apiError(
  status: number,
  code: string,
  message: string,
  details?: unknown
) {
  const error: ApiErrorPayload = { code, message, ...(details ? { details } : {}) };
  return NextResponse.json({ data: null, error }, { status });
}
