export function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  const codes: Record<string, number> = {
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    CONFLICT: 409,
    GOOGLE_SIGN_IN_REQUIRED: 401,
    STORAGE_NOT_CONFIGURED: 503,
    SECRET_NOT_CONFIGURED: 503,
    SETUP_REQUIRED: 503,
    DRIVE_ACCESS_DENIED: 403,
    DRIVE_TOO_LARGE: 422,
  };
  return Response.json(
    { error: codes[message] ? message : "REQUEST_FAILED" },
    { status: codes[message] || 400 },
  );
}
