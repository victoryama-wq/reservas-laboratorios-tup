import {
  LabDoc,
  NotificationType,
  ReservationDoc,
} from "../../shared/models";
import {INSTITUTIONAL_TIME_ZONE} from
  "../reservations/reservation.utils";
import {INSTITUTIONAL_LOGO_CONTENT_ID} from "./email-assets";

const BRAND_GRAY = "#888887";
const BRAND_BLUE = "#252a86";
const BRAND_DARK = "#271e5d";
const BRAND_WHITE = "#ffffff";
const PAGE_BACKGROUND = "#f4f5f9";
const BORDER_COLOR = "#dedcf0";

export interface EmailTemplateResult {
  subject: string;
  body: string;
  htmlBody: string;
}

interface DetailItem {
  label: string;
  value: string;
}

interface NotificationCopy {
  title: string;
  statusLabel: string;
  introParagraphs: string[];
}

interface PlainTextBodyParams {
  title: string;
  greeting: string;
  introParagraphs: string[];
  details: DetailItem[];
  responsibleNote?: string;
}

interface EmailAction {
  label: string;
  url: string;
}

interface InstitutionalEmailLayoutParams {
  copy: NotificationCopy;
  details: DetailItem[];
  greeting: string;
  reservation: ReservationDoc;
  responsibleNote?: string;
  action?: EmailAction;
}

/**
 * Builds a Spanish institutional email for a reservation notification.
 *
 * @param {object} params Template params.
 * @param {NotificationType} params.type Notification type.
 * @param {ReservationDoc} params.reservation Reservation document.
 * @param {LabDoc} params.lab Laboratory document.
 * @param {string | undefined} params.reason Status or error reason.
 * @return {EmailTemplateResult} Email subject and bodies.
 */
export function buildReservationEmailTemplate(params: {
  type: NotificationType;
  reservation: ReservationDoc;
  lab: LabDoc;
  reason?: string;
}): EmailTemplateResult {
  const copy = getNotificationCopy(params.type, params.reason);
  const subject = buildSubject(
      params.type,
      params.reservation,
      params.lab,
  );
  const details = buildReservationDetails(
      params.reservation,
      params.reason,
  );
  const responsibleNote = buildResponsibleNote(params.reservation);
  const greeting = buildGreeting(params.reservation.teacherName);
  const body = buildPlainTextBody({
    title: copy.title,
    greeting,
    introParagraphs: copy.introParagraphs,
    details,
    responsibleNote,
  });

  return {
    subject,
    body,
    htmlBody: buildInstitutionalEmailLayout({
      copy,
      details,
      greeting,
      reservation: params.reservation,
      responsibleNote,
    }),
  };
}

/**
 * Builds the email subject by notification type.
 *
 * @param {NotificationType} type Notification type.
 * @param {ReservationDoc} reservation Reservation document.
 * @param {LabDoc} lab Laboratory document.
 * @return {string} Email subject.
 */
function buildSubject(
    type: NotificationType,
    reservation: ReservationDoc,
    lab: LabDoc,
): string {
  const folio = reservation.folio || "reserva";
  const labName = reservation.labName || lab.name || "laboratorio";

  if (type === "RESERVATION_CONFIRMED") {
    return `✅ Reserva confirmada – ${labName}`;
  }

  if (type === "RESERVATION_PENDING_APPROVAL") {
    return `🕒 Reserva pendiente de validación – ${labName}`;
  }

  if (type === "RESERVATION_APPROVED") {
    return `✅ Reserva aprobada – ${labName}`;
  }

  if (type === "RESERVATION_REJECTED") {
    return `❌ Reserva rechazada – ${labName}`;
  }

  if (type === "CALENDAR_ERROR") {
    return `⚠️ Error de calendario – ${folio}`;
  }

  if (type === "RESERVATION_CANCELLED") {
    return `🚫 Reserva cancelada – ${labName}`;
  }

  return `⚠️ Error técnico en reserva – ${folio}`;
}

/**
 * Returns copy by notification type.
 *
 * @param {NotificationType} type Notification type.
 * @param {string | undefined} reason Optional reason.
 * @return {NotificationCopy} Copy tokens.
 */
function getNotificationCopy(
    type: NotificationType,
    reason?: string,
): NotificationCopy {
  if (type === "RESERVATION_CONFIRMED") {
    return {
      title: "Reserva confirmada",
      statusLabel: "Confirmada",
      introParagraphs: [
        "Tu reserva fue confirmada y sincronizada con Google Calendar.",
        "Conserva el folio para cualquier seguimiento institucional.",
      ],
    };
  }

  if (type === "RESERVATION_PENDING_APPROVAL") {
    return {
      title: "Reserva pendiente de validación",
      statusLabel: "Pendiente de validación",
      introParagraphs: [
        "Tu solicitud ya fue registrada y está en revisión.",
        [
          "El responsable del laboratorio validará las condiciones de",
          "seguridad y el protocolo correspondiente.",
        ].join(" "),
      ],
    };
  }

  if (type === "RESERVATION_APPROVED") {
    return {
      title: "Reserva aprobada",
      statusLabel: "Aprobada",
      introParagraphs: [
        "La solicitud fue aprobada por el responsable del laboratorio.",
        "La reserva quedó confirmada y sincronizada con Google Calendar.",
      ],
    };
  }

  if (type === "RESERVATION_REJECTED") {
    return {
      title: "Reserva rechazada",
      statusLabel: "Rechazada",
      introParagraphs: [
        "La solicitud no pudo ser autorizada.",
        reason ?
          `Motivo registrado: ${reason}` :
          "Revisa el detalle de la solicitud en el sistema.",
      ],
    };
  }

  if (type === "CALENDAR_ERROR") {
    return {
      title: "Revisión técnica requerida",
      statusLabel: "Error de calendario",
      introParagraphs: [
        [
          "La reserva requiere atención de Admin/Sistemas por un error",
          "técnico al sincronizar Google Calendar.",
        ].join(" "),
        "El horario queda protegido hasta que se resuelva la incidencia.",
      ],
    };
  }

  if (type === "RESERVATION_CANCELLED") {
    return {
      title: "Reserva cancelada",
      statusLabel: "Cancelada",
      introParagraphs: [
        "La reserva fue cancelada en el sistema institucional.",
        "El horario queda liberado de acuerdo con las reglas vigentes.",
      ],
    };
  }

  if (type === "TECHNICAL_ERROR") {
    return {
      title: "Error técnico en reserva",
      statusLabel: "Revisión técnica",
      introParagraphs: [
        [
          "El sistema registró un incidente técnico relacionado con",
          "la reserva.",
        ].join(" "),
        "Admin/Sistemas debe revisar la incidencia desde el sistema.",
      ],
    };
  }

  return {
    title: "Notificación técnica",
    statusLabel: "Revisión requerida",
    introParagraphs: [
      [
        "El sistema registró una notificación técnica relacionada",
        "con la reserva.",
      ].join(" "),
    ],
  };
}

/**
 * Builds the plain text fallback body.
 *
 * @param {PlainTextBodyParams} params Plain text params.
 * @return {string} Plain text body.
 */
function buildPlainTextBody(params: PlainTextBodyParams): string {
  return [
    params.title,
    "",
    params.greeting,
    "",
    ...params.introParagraphs,
    "",
    ...params.details.map((detail) => `${detail.label}: ${detail.value}`),
    "",
    params.responsibleNote,
    "",
    "No se adjuntan protocolos ni enlaces públicos a archivos.",
    "Mensaje generado por el Sistema Web de Reservas de Laboratorios.",
  ].filter((line): line is string => Boolean(line)).join("\n");
}

/**
 * Builds common reservation details.
 *
 * @param {ReservationDoc} reservation Reservation document.
 * @param {string | undefined} reason Status reason.
 * @return {DetailItem[]} Email detail items.
 */
function buildReservationDetails(
    reservation: ReservationDoc,
    reason?: string,
): DetailItem[] {
  const protocolRequired = reservation.protocolRequired ||
    reservation.risky ||
    reservation.externalParticipants;
  const items: DetailItem[] = [
    {label: "Folio", value: reservation.folio},
    {label: "Estatus", value: reservation.status},
    {label: "Laboratorio", value: reservation.labName},
    {label: "Fecha", value: formatDate(reservation.startAt.toDate())},
    {
      label: "Horario",
      value: [
        formatTime(reservation.startAt.toDate()),
        formatTime(reservation.endAt.toDate()),
      ].join(" - "),
    },
    {label: "Docente", value: reservation.teacherName},
    {label: "Correo", value: reservation.teacherEmail},
    {label: "Asignatura", value: reservation.subject},
    {label: "Grupo", value: reservation.group},
    {label: "Tipo de práctica", value: reservation.practiceType},
  ];

  if (reservation.practiceType === "Otro") {
    items.push({
      label: "Especificación",
      value: reservation.practiceTypeOther || "No indicada",
    });
  }

  items.push(
      {label: "Material riesgoso", value: yesNo(reservation.risky)},
      {
        label: "Pacientes, usuarios simulados o población externa",
        value: yesNo(reservation.externalParticipants),
      },
      {label: "Protocolo requerido", value: yesNo(protocolRequired)},
      {
        label: "Protocolo adjunto",
        value: yesNo(reservation.protocolFiles.length > 0),
      },
      {
        label: "Archivo(s)",
        value: reservation.protocolFiles.length ?
          reservation.protocolFiles.map((file) => file.fileName).join(", ") :
          "No aplica",
      },
      {
        label: "Material requerido",
        value: reservation.materialRequired || "No indicado",
      },
      {label: "Práctica", value: reservation.practiceName},
      {label: "Objetivo", value: reservation.objective},
  );

  if (reason) {
    items.push({label: "Motivo", value: reason});
  }

  return items;
}

/**
 * Builds the HTML body with the institutional visual style.
 *
 * @param {InstitutionalEmailLayoutParams} params Email params.
 * @return {string} HTML body.
 */
function buildInstitutionalEmailLayout(
    params: InstitutionalEmailLayoutParams,
): string {
  const detailsHtml = params.details.map((item) => detailRow(item)).join("");
  const introHtml = params.copy.introParagraphs
      .map((paragraph) => `<p style="${paragraphStyle()}">${
        escapeHtml(paragraph)
      }</p>`)
      .join("");
  const noteHtml = params.responsibleNote ?
    [
      `<div style="${calloutStyle()}">`,
      escapeHtml(params.responsibleNote),
      "</div>",
    ].join("") :
    "";
  const actionHtml = params.action ? actionButton(params.action) : "";

  return `<!doctype html>
<html lang="es">
  <body style="${bodyStyle()}">
    <table ${tableAttrs(pageTableStyle())}>
      <tr>
        <td align="center" style="padding:28px 12px;">
          <table ${tableAttrs(cardStyle())}>
            ${logoSection()}
            ${heroSection(params.copy.title)}
            <tr>
              <td style="padding:30px 32px 24px;">
                <p style="${greetingStyle()}">${escapeHtml(params.greeting)}</p>
                ${introHtml}
                ${statusPanel(params.copy.statusLabel, params.reservation)}
                <table ${tableAttrs(detailsTableStyle())}>
                  ${detailsHtml}
                </table>
                ${actionHtml}
                ${noteHtml}
                ${securityNote()}
              </td>
            </tr>
            ${footerSection()}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Builds the logo header section.
 *
 * @return {string} HTML.
 */
function logoSection(): string {
  return `<tr>
    <td style="padding:24px 28px;background:${BRAND_WHITE};">
      <img src="cid:${INSTITUTIONAL_LOGO_CONTENT_ID}"
        alt="Tecnológico Universitario Playacar"
        width="270"
        style="display:block;max-width:270px;width:100%;height:auto;border:0;">
    </td>
  </tr>`;
}

/**
 * Builds the purple hero section.
 *
 * @param {string} title Email title.
 * @return {string} HTML.
 */
function heroSection(title: string): string {
  return `<tr>
    <td style="${heroCellStyle()}">
      <div style="${kickerStyle()}">
        Sistema Web de Reservas de Laboratorios
      </div>
      <div style="${heroTitleStyle()}">${escapeHtml(title)}</div>
    </td>
  </tr>`;
}

/**
 * Builds the status panel.
 *
 * @param {string} status Status label.
 * @param {ReservationDoc} reservation Reservation document.
 * @return {string} HTML.
 */
function statusPanel(status: string, reservation: ReservationDoc): string {
  return `<div style="${statusPanelStyle()}">
    <div style="${statusKickerStyle()}">Estatus actual</div>
    <div style="${statusTextStyle()}">${escapeHtml(status)}</div>
    <div style="${statusMetaStyle()}">
      Folio ${escapeHtml(reservation.folio || "No asignado")}
    </div>
  </div>`;
}

/**
 * Builds an optional action button.
 *
 * @param {EmailAction} action Email action.
 * @return {string} HTML.
 */
function actionButton(action: EmailAction): string {
  return `<div style="text-align:center;margin:28px 0 6px;">
    <a href="${escapeHtml(action.url)}" style="${buttonStyle()}">
      ${escapeHtml(action.label)}
    </a>
  </div>`;
}

/**
 * Builds a detail row.
 *
 * @param {DetailItem} item Detail item.
 * @return {string} HTML.
 */
function detailRow(item: DetailItem): string {
  return `<tr>
    <td style="${detailLabelStyle()}">${escapeHtml(item.label)}</td>
    <td style="${detailValueStyle()}">${formatHtmlValue(item.value)}</td>
  </tr>`;
}

/**
 * Builds a security note.
 *
 * @return {string} HTML.
 */
function securityNote(): string {
  return `<p style="${smallNoteStyle()}">
    Por seguridad institucional no se adjuntan protocolos ni se incluyen
    enlaces públicos a Cloud Storage.
  </p>`;
}

/**
 * Builds footer section.
 *
 * @return {string} HTML.
 */
function footerSection(): string {
  return `<tr>
    <td style="${footerCellStyle()}">
      <div style="font-size:14px;font-weight:800;">
        Tecnológico Universitario Playacar
      </div>
      <div style="font-size:12px;font-weight:600;margin-top:6px;">
        Innovación con sentido humano
      </div>
    </td>
  </tr>`;
}

/**
 * Builds a protocol review note.
 *
 * @param {ReservationDoc} reservation Reservation document.
 * @return {string | undefined} Review note.
 */
function buildResponsibleNote(
    reservation: ReservationDoc,
): string | undefined {
  if (!reservation.protocolFiles.length) {
    return undefined;
  }

  return [
    "El protocolo debe revisarse desde el sistema.",
    "Por seguridad no se adjuntan archivos ni enlaces públicos.",
  ].join(" ");
}

/**
 * Builds greeting text.
 *
 * @param {string} teacherName Teacher name.
 * @return {string} Greeting.
 */
function buildGreeting(teacherName: string): string {
  const name = teacherName.trim() || "usuario";
  return `Hola ${name},`;
}

/**
 * Returns reusable table attributes for email markup.
 *
 * @param {string} style Inline CSS.
 * @return {string} HTML attributes.
 */
function tableAttrs(style: string): string {
  return [
    "role=\"presentation\"",
    "width=\"100%\"",
    "cellspacing=\"0\"",
    "cellpadding=\"0\"",
    `style="${style}"`,
  ].join(" ");
}

/**
 * Returns yes/no label.
 *
 * @param {boolean} value Boolean value.
 * @return {string} Label.
 */
function yesNo(value: boolean): string {
  return value ? "Sí" : "No";
}

/**
 * Escapes HTML text.
 *
 * @param {string} value Raw value.
 * @return {string} Escaped value.
 */
function escapeHtml(value: string): string {
  return value
      .replace(/&/gu, "&amp;")
      .replace(/</gu, "&lt;")
      .replace(/>/gu, "&gt;")
      .replace(/"/gu, "&quot;")
      .replace(/'/gu, "&#039;");
}

/**
 * Formats a value for HTML output.
 *
 * @param {string} value Raw value.
 * @return {string} HTML value.
 */
function formatHtmlValue(value: string): string {
  return escapeHtml(value).replace(/\n/gu, "<br>");
}

/**
 * Formats a date for institutional emails.
 *
 * @param {Date} value Date.
 * @return {string} Formatted date.
 */
function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: INSTITUTIONAL_TIME_ZONE,
  }).format(value);
}

/**
 * Formats time for institutional emails.
 *
 * @param {Date} value Date.
 * @return {string} Formatted time.
 */
function formatTime(value: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: INSTITUTIONAL_TIME_ZONE,
  }).format(value);
}

/**
 * Returns page body style.
 *
 * @return {string} CSS style.
 */
function bodyStyle(): string {
  return [
    "margin:0",
    `background:${PAGE_BACKGROUND}`,
    "font-family:Arial,Helvetica,sans-serif",
    "color:#1f1b4b",
  ].join(";");
}

/**
 * Returns page table style.
 *
 * @return {string} CSS style.
 */
function pageTableStyle(): string {
  return `background:${PAGE_BACKGROUND};margin:0;padding:0`;
}

/**
 * Returns card style.
 *
 * @return {string} CSS style.
 */
function cardStyle(): string {
  return [
    "max-width:640px",
    `background:${BRAND_WHITE}`,
    `border:1px solid ${BORDER_COLOR}`,
    "border-radius:14px",
    "overflow:hidden",
    "box-shadow:0 18px 42px rgba(39,30,93,0.12)",
  ].join(";");
}

/**
 * Returns email kicker style.
 *
 * @return {string} CSS style.
 */
function kickerStyle(): string {
  return [
    "font-size:13px",
    "font-weight:800",
    "letter-spacing:.08em",
    "line-height:1.4",
    "text-transform:uppercase",
    `color:${BRAND_WHITE}`,
  ].join(";");
}

/**
 * Returns hero cell style.
 *
 * @return {string} CSS style.
 */
function heroCellStyle(): string {
  return [
    `background:${BRAND_DARK}`,
    `border-top:4px solid ${BRAND_BLUE}`,
    "padding:24px 28px",
  ].join(";");
}

/**
 * Returns hero title style.
 *
 * @return {string} CSS style.
 */
function heroTitleStyle(): string {
  return [
    "font-size:28px",
    "font-weight:900",
    "line-height:1.18",
    "margin-top:10px",
    `color:${BRAND_WHITE}`,
  ].join(";");
}

/**
 * Returns greeting style.
 *
 * @return {string} CSS style.
 */
function greetingStyle(): string {
  return [
    "margin:0 0 18px",
    "font-size:18px",
    "line-height:1.45",
    `color:${BRAND_DARK}`,
  ].join(";");
}

/**
 * Returns paragraph style.
 *
 * @return {string} CSS style.
 */
function paragraphStyle(): string {
  return [
    "margin:0 0 14px",
    "font-size:15px",
    "line-height:1.65",
    "color:#39364f",
  ].join(";");
}

/**
 * Returns status panel style.
 *
 * @return {string} CSS style.
 */
function statusPanelStyle(): string {
  return [
    "margin:24px 0 22px",
    "background:#f3f1ff",
    "border:1px solid #d9d4ff",
    "border-radius:12px",
    "padding:18px 20px",
  ].join(";");
}

/**
 * Returns status kicker style.
 *
 * @return {string} CSS style.
 */
function statusKickerStyle(): string {
  return [
    "font-size:12px",
    "font-weight:900",
    "letter-spacing:.06em",
    "text-transform:uppercase",
    `color:${BRAND_DARK}`,
  ].join(";");
}

/**
 * Returns status text style.
 *
 * @return {string} CSS style.
 */
function statusTextStyle(): string {
  return [
    "margin-top:10px",
    "font-size:24px",
    "line-height:1.2",
    "font-weight:900",
    `color:${BRAND_DARK}`,
  ].join(";");
}

/**
 * Returns status meta style.
 *
 * @return {string} CSS style.
 */
function statusMetaStyle(): string {
  return [
    "margin-top:8px",
    "font-size:13px",
    "line-height:1.4",
    "font-weight:800",
    `color:${BRAND_BLUE}`,
  ].join(";");
}

/**
 * Returns action button style.
 *
 * @return {string} CSS style.
 */
function buttonStyle(): string {
  return [
    "display:inline-block",
    `background:${BRAND_DARK}`,
    `color:${BRAND_WHITE}`,
    "border-radius:8px",
    "padding:14px 24px",
    "font-size:14px",
    "font-weight:900",
    "line-height:1",
    "text-decoration:none",
  ].join(";");
}

/**
 * Returns details table style.
 *
 * @return {string} CSS style.
 */
function detailsTableStyle(): string {
  return [
    "border-collapse:collapse",
    "margin-top:14px",
    `border-top:1px solid ${BORDER_COLOR}`,
  ].join(";");
}

/**
 * Returns detail label style.
 *
 * @return {string} CSS style.
 */
function detailLabelStyle(): string {
  return [
    "width:42%",
    `border-bottom:1px solid ${BORDER_COLOR}`,
    "padding:12px 0",
    "font-size:13px",
    "line-height:1.45",
    `color:${BRAND_GRAY}`,
    "vertical-align:top",
  ].join(";");
}

/**
 * Returns detail value style.
 *
 * @return {string} CSS style.
 */
function detailValueStyle(): string {
  return [
    `border-bottom:1px solid ${BORDER_COLOR}`,
    "padding:12px 0 12px 18px",
    "font-size:13px",
    "line-height:1.45",
    "font-weight:800",
    `color:${BRAND_DARK}`,
    "text-align:right",
    "vertical-align:top",
  ].join(";");
}

/**
 * Returns callout style.
 *
 * @return {string} CSS style.
 */
function calloutStyle(): string {
  return [
    "margin-top:20px",
    "border-radius:12px",
    `border:1px solid ${BORDER_COLOR}`,
    "background:#f7f6ff",
    `color:${BRAND_DARK}`,
    "font-size:14px",
    "font-weight:700",
    "line-height:1.55",
    "padding:16px 18px",
  ].join(";");
}

/**
 * Returns small note style.
 *
 * @return {string} CSS style.
 */
function smallNoteStyle(): string {
  return [
    "margin:22px 0 0",
    "font-size:12px",
    "line-height:1.55",
    `color:${BRAND_GRAY}`,
  ].join(";");
}

/**
 * Returns footer cell style.
 *
 * @return {string} CSS style.
 */
function footerCellStyle(): string {
  return [
    `background:${BRAND_DARK}`,
    "padding:22px 28px",
    `color:${BRAND_WHITE}`,
  ].join(";");
}
