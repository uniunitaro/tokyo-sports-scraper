class CookieJar {
  private readonly cookies = new Map<string, string>();

  read(headers: Headers) {
    for (const header of getSetCookieHeaders(headers)) {
      const firstPart = header.split(';', 1)[0];
      const separatorIndex = firstPart.indexOf('=');
      if (separatorIndex <= 0) {
        continue;
      }
      const name = firstPart.slice(0, separatorIndex).trim();
      const value = firstPart.slice(separatorIndex + 1).trim();
      if (value.length === 0) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }
  }

  header() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }
}

const getSetCookieHeaders = (headers: Headers) => {
  const maybeGetSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };
  const values = maybeGetSetCookie.getSetCookie?.();
  if (values && values.length > 0) {
    return values;
  }

  const combined = headers.get('set-cookie');
  if (!combined) {
    return [];
  }
  return splitCombinedSetCookie(combined);
};

const splitCombinedSetCookie = (value: string) =>
  value.split(/,(?=\s*[^;,=\s]+=[^;,]+)/g).map((part) => part.trim());

export { CookieJar };
