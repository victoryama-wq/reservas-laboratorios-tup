import {existsSync, readFileSync} from "fs";
import {join} from "path";

export const INSTITUTIONAL_LOGO_CONTENT_ID = "tup-logo";
export const INSTITUTIONAL_LOGO_FILENAME = "logo_tup.png";
export const INSTITUTIONAL_LOGO_MIME_TYPE = "image/png";

let cachedLogoBase64: string | undefined;

/**
 * Returns the institutional logo encoded as base64 for inline emails.
 *
 * @return {string | undefined} Base64 encoded PNG logo.
 */
export function getInstitutionalLogoBase64(): string | undefined {
  if (cachedLogoBase64 !== undefined) {
    return cachedLogoBase64;
  }

  const candidates = [
    join(
        process.cwd(),
        "functions",
        "src",
        "modules",
        "notifications",
        "assets",
        INSTITUTIONAL_LOGO_FILENAME,
    ),
    join(
        process.cwd(),
        "functions",
        "lib",
        "modules",
        "notifications",
        "assets",
        INSTITUTIONAL_LOGO_FILENAME,
    ),
    join(
        process.cwd(),
        "src",
        "modules",
        "notifications",
        "assets",
        INSTITUTIONAL_LOGO_FILENAME,
    ),
    join(
        process.cwd(),
        "lib",
        "modules",
        "notifications",
        "assets",
        INSTITUTIONAL_LOGO_FILENAME,
    ),
    join(
        __dirname,
        "assets",
        INSTITUTIONAL_LOGO_FILENAME,
    ),
    join(
        __dirname,
        "..",
        "..",
        "..",
        "src",
        "modules",
        "notifications",
        "assets",
        INSTITUTIONAL_LOGO_FILENAME,
    ),
  ];

  const logoPath = candidates.find((candidate) => existsSync(candidate));
  cachedLogoBase64 = logoPath ?
    readFileSync(logoPath).toString("base64") :
    undefined;

  return cachedLogoBase64;
}
