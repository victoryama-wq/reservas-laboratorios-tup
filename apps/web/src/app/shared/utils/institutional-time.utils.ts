export const INSTITUTIONAL_TIME_ZONE = "America/Cancun";

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: INSTITUTIONAL_TIME_ZONE,
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
  hourCycle: "h23",
});

/** Devuelve las partes civiles de un instante en Cancún.
 * @param {Date} date Instante.
 * @return {Record<string, string>} Partes.
 */
function parts(date: Date): Record<string, string> {
  return Object.fromEntries(formatter.formatToParts(date)
      .map((part) => [part.type, part.value]));
}

/** Fecha institucional, independiente de la zona del dispositivo.
 * @param {Date} date Instante.
 * @return {string} Fecha YYYY-MM-DD.
 */
export function institutionalDateKey(date: Date): string {
  const value = parts(date);
  return `${value["year"]}-${value["month"]}-${value["day"]}`;
}

/** Hora institucional.
 * @param {Date} date Instante.
 * @return {string} Hora HH:mm.
 */
export function institutionalTime(date: Date): string {
  const value = parts(date);
  return `${value["hour"]}:${value["minute"]}`;
}

/** Convierte una fecha y hora civiles de Cancún en un instante.
 * @param {string} day Fecha YYYY-MM-DD.
 * @param {string} time Hora HH:mm.
 * @return {Date} Instante.
 */
export function institutionalDateTime(day: string, time = "00:00"): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error("Fecha u horario inválido.");
  }
  const target = Date.parse(`${day}T${time}:00Z`);
  if (!Number.isFinite(target)) throw new Error("Fecha inválida.");
  let instant = target;
  for (let index = 0; index < 3; index++) {
    const value = parts(new Date(instant));
    const represented = Date.parse(
        `${value["year"]}-${value["month"]}-${value["day"]}T` +
        `${value["hour"]}:${value["minute"]}:${value["second"]}Z`,
    );
    instant += target - represented;
  }
  const result = new Date(instant);
  if (institutionalDateKey(result) !== day ||
      institutionalTime(result) !== time) {
    throw new Error("Fecha u horario inválido.");
  }
  return result;
}

/** Desplaza una fecha civil sin depender del horario del servidor.
 * @param {string} day Fecha civil.
 * @param {number} days Días.
 * @return {string} Fecha civil.
 */
export function shiftDateKey(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Día de la semana de una fecha civil.
 * @param {string} day Fecha civil.
 * @return {number} Domingo 0 a sábado 6.
 */
export function institutionalWeekday(day: string): number {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

/** Fecha civil de un control Datepicker; no representa un instante.
 * @param {Date} date Valor del control.
 * @return {string} Fecha civil.
 */
export function datePickerKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Adaptación de fecha civil al control Datepicker.
 * @param {string} day Fecha civil.
 * @return {Date} Valor del control.
 */
export function datePickerDate(day: string): Date {
  return new Date(`${day}T00:00:00`);
}
