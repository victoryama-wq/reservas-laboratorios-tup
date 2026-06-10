import {gmail_v1 as gmailApi, google} from "googleapis";

import {
  createWorkspaceJwt,
  getWorkspaceSubjectEmail,
} from "../google-workspace/google-workspace-auth.service";
import {
  getInstitutionalLogoBase64,
  INSTITUTIONAL_LOGO_CONTENT_ID,
  INSTITUTIONAL_LOGO_FILENAME,
  INSTITUTIONAL_LOGO_MIME_TYPE,
} from "./email-assets";

const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

export interface SendEmailParams {
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  htmlBody?: string;
}

/**
 * Sends institutional email through Google Workspace Gmail API.
 */
export class GmailService {
  private gmailClient?: gmailApi.Gmail;

  /**
   * Sends an email with Gmail API.
   *
   * @param {SendEmailParams} params Email params.
   * @return {Promise<string>} Gmail provider message id.
   */
  async sendEmail(params: SendEmailParams): Promise<string> {
    const client = await this.getGmailClient();
    const response = await client.users.messages.send({
      userId: "me",
      requestBody: {
        raw: this.encodeMessage(this.buildMimeMessage(params)),
      },
    });

    const messageId = response.data.id;
    if (!messageId) {
      throw new Error("Gmail API no devolvio messageId.");
    }

    return messageId;
  }

  /**
   * Returns an authenticated Gmail API client.
   *
   * @return {Promise<gmailApi.Gmail>} Gmail client.
   */
  private async getGmailClient(): Promise<gmailApi.Gmail> {
    if (this.gmailClient) {
      return this.gmailClient;
    }

    const auth = await createWorkspaceJwt([GMAIL_SEND_SCOPE]);
    this.gmailClient = google.gmail({version: "v1", auth});
    return this.gmailClient;
  }

  /**
   * Builds a MIME message with text and optional HTML body.
   *
   * @param {SendEmailParams} params Email params.
   * @return {string} MIME message.
   */
  private buildMimeMessage(params: SendEmailParams): string {
    const headers = [
      `From: ${getWorkspaceSubjectEmail()}`,
      `To: ${params.to.map(sanitizeHeaderValue).join(", ")}`,
      params.cc?.length ?
        `Cc: ${params.cc.map(sanitizeHeaderValue).join(", ")}` :
        undefined,
      `Subject: ${encodeSubject(params.subject)}`,
      "MIME-Version: 1.0",
    ].filter((header): header is string => Boolean(header));

    if (!params.htmlBody) {
      return [
        ...headers,
        "Content-Type: text/plain; charset=\"UTF-8\"",
        "Content-Transfer-Encoding: 8bit",
        "",
        params.body,
      ].join("\r\n");
    }

    const logoBase64 = params.htmlBody.includes(
        `cid:${INSTITUTIONAL_LOGO_CONTENT_ID}`,
    ) ? getInstitutionalLogoBase64() : undefined;
    const boundary = `boundary_${Date.now().toString(36)}`;
    const alternativeMessage = [
      `--${boundary}`,
      "Content-Type: text/plain; charset=\"UTF-8\"",
      "Content-Transfer-Encoding: 8bit",
      "",
      params.body,
      `--${boundary}`,
      "Content-Type: text/html; charset=\"UTF-8\"",
      "Content-Transfer-Encoding: 8bit",
      "",
      params.htmlBody,
      `--${boundary}--`,
    ].join("\r\n");

    if (logoBase64) {
      const relatedBoundary = `related_${Date.now().toString(36)}`;
      return [
        ...headers,
        `Content-Type: multipart/related; boundary="${relatedBoundary}"`,
        "",
        `--${relatedBoundary}`,
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        "",
        alternativeMessage,
        `--${relatedBoundary}`,
        `Content-Type: ${INSTITUTIONAL_LOGO_MIME_TYPE}; ` +
          `name="${INSTITUTIONAL_LOGO_FILENAME}"`,
        "Content-Transfer-Encoding: base64",
        `Content-ID: <${INSTITUTIONAL_LOGO_CONTENT_ID}>`,
        "Content-Disposition: inline; " +
          `filename="${INSTITUTIONAL_LOGO_FILENAME}"`,
        "",
        wrapBase64(logoBase64),
        `--${relatedBoundary}--`,
      ].join("\r\n");
    }

    return [
      ...headers,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      alternativeMessage,
    ].join("\r\n");
  }

  /**
   * Encodes a MIME message in base64url for Gmail API.
   *
   * @param {string} message MIME message.
   * @return {string} Base64url message.
   */
  private encodeMessage(message: string): string {
    return Buffer
        .from(message, "utf8")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/u, "");
  }
}

/**
 * Wraps base64 data to a MIME-friendly line length.
 *
 * @param {string} value Base64 text.
 * @return {string} Wrapped base64 text.
 */
function wrapBase64(value: string): string {
  return value.match(/.{1,76}/gu)?.join("\r\n") ?? value;
}

/**
 * Encodes non-ASCII subjects safely.
 *
 * @param {string} subject Email subject.
 * @return {string} Encoded subject.
 */
function encodeSubject(subject: string): string {
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

/**
 * Removes CR/LF from mail headers.
 *
 * @param {string} value Header value.
 * @return {string} Safe header value.
 */
function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/gu, " ").trim();
}
