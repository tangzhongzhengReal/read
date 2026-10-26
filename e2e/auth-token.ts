export const authToken =
  process.env.READ_AUTH_TOKEN && process.env.READ_AUTH_TOKEN.length > 0
    ? process.env.READ_AUTH_TOKEN
    : "marctang33";
