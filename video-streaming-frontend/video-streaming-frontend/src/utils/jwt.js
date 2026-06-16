// Decodes a JWT payload as UTF-8 JSON.
// atob() returns a binary string (one char per byte, Latin-1), so multi-byte
// UTF-8 sequences (e.g. Azerbaijani ə, ı, ş, ç, ğ, ö, ü) must be re-escaped
// to %XX form and run through decodeURIComponent before JSON.parse.
export function decodeJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const json = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  return JSON.parse(json);
}
