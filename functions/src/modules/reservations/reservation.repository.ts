import {
  CollectionReference,
  DocumentReference,
  Firestore,
  QueryDocumentSnapshot,
  Timestamp,
  Transaction,
} from "firebase-admin/firestore";

import {
  AppUser,
  BlockedPeriodDoc,
  LabDoc,
  ReservationDoc,
  ReservationStatus,
  SystemSettingsDoc,
} from "../../shared/models";
import {removeUndefinedValues} from "../shared/firestore.utils";
import {
  BLOCKING_RESERVATION_STATUSES,
  rangesOverlap,
} from "./reservation.utils";

/**
 * Handles reservation persistence.
 */
export class ReservationRepository {
  /**
   * Creates a repository.
   *
   * @param {Firestore} db Firestore database.
   */
  constructor(private readonly db: Firestore) {}

  /**
   * Reads a user profile.
   *
   * @param {string} uid User uid.
   * @return {Promise<AppUser | null>} User profile.
   */
  async getUserProfile(uid: string): Promise<AppUser | null> {
    const snapshot = await this.db.collection("users").doc(uid).get();
    return snapshot.exists ? (snapshot.data() as AppUser) : null;
  }

  /**
   * Finds a laboratory by id or slug.
   *
   * @param {string | undefined} labId Laboratory id.
   * @param {string | undefined} labSlug Laboratory slug.
   * @return {Promise<LabDoc | null>} Laboratory document.
   */
  async getLab(
      labId: string | undefined,
      labSlug: string | undefined,
  ): Promise<LabDoc | null> {
    if (labId) {
      const snapshot = await this.db.collection("labs").doc(labId).get();
      return snapshot.exists ? (snapshot.data() as LabDoc) : null;
    }

    const snapshot = await this.db
        .collection("labs")
        .where("slug", "==", labSlug)
        .limit(1)
        .get();
    const document = snapshot.docs[0];
    return document ? (document.data() as LabDoc) : null;
  }

  /**
   * Reads a reservation by id.
   *
   * @param {string} reservationId Reservation id.
   * @return {Promise<ReservationDoc | null>} Reservation document.
   */
  async getReservationById(
      reservationId: string,
  ): Promise<ReservationDoc | null> {
    const snapshot = await this.db
        .collection("reservations")
        .doc(reservationId)
        .get();

    return snapshot.exists ? (snapshot.data() as ReservationDoc) : null;
  }

  /**
   * Reads global system settings.
   *
   * @return {Promise<SystemSettingsDoc | null>} Global settings.
   */
  async getSystemSettings(): Promise<SystemSettingsDoc | null> {
    const snapshot = await this.db
        .collection("systemSettings")
        .doc("global")
        .get();

    return snapshot.exists ? (snapshot.data() as SystemSettingsDoc) : null;
  }

  /**
   * Creates an empty reservation document reference.
   *
   * @return {DocumentReference} Reservation reference.
   */
  createReservationRef(): DocumentReference {
    return this.db.collection("reservations").doc();
  }

  /**
   * Runs a transaction.
   *
   * @param {function(Transaction): Promise<T>} update Transaction body.
   * @return {Promise<T>} Transaction result.
   */
  async runTransaction<T>(
      update: (transaction: Transaction) => Promise<T>,
  ): Promise<T> {
    return this.db.runTransaction(update);
  }

  /**
   * Finds internal conflicts in Firestore for blocking statuses.
   *
   * @param {Transaction} transaction Firestore transaction.
   * @param {string} labId Laboratory id.
   * @param {Date} startAt Start date.
   * @param {Date} endAt End date.
   * @param {string | undefined} excludeReservationId Reservation to exclude.
   * @return {Promise<ReservationDoc[]>} Conflicting reservations.
   */
  async findBlockingConflicts(
      transaction: Transaction,
      labId: string,
      startAt: Date,
      endAt: Date,
      excludeReservationId?: string,
  ): Promise<ReservationDoc[]> {
    const query = this.reservations()
        .where("labId", "==", labId)
        .where("status", "in", BLOCKING_RESERVATION_STATUSES);
    const snapshot = await transaction.get(query);

    return snapshot.docs
        .map((document) => this.toReservationDoc(document))
        .filter((reservation) => reservation.id !== excludeReservationId)
        .filter((reservation) => {
          const reservationStart = this.toDate(reservation.startAt);
          const reservationEnd = this.toDate(reservation.endAt);

          if (!reservationStart || !reservationEnd) {
            return false;
          }

          return rangesOverlap(
              startAt,
              endAt,
              reservationStart,
              reservationEnd,
          );
        });
  }

  /**
   * Finds active blocked periods that affect a requested lab and range.
   *
   * @param {string} labId Laboratory id.
   * @param {Date} startAt Start date.
   * @param {Date} endAt End date.
   * @return {Promise<BlockedPeriodDoc[]>} Matching blocked periods.
   */
  async findActiveBlockedPeriods(
      labId: string,
      startAt: Date,
      endAt: Date,
  ): Promise<BlockedPeriodDoc[]> {
    const snapshot = await this.db
        .collection("blockedPeriods")
        .where("active", "==", true)
        .get();

    return snapshot.docs
        .map((document) => document.data() as BlockedPeriodDoc)
        .filter((period) => {
          if (
            period.scope === "lab" &&
            !(period.labIds ?? []).includes(labId)
          ) {
            return false;
          }
          const periodStart = this.toDate(period.startAt);
          const periodEnd = this.toDate(period.endAt);

          return Boolean(
              periodStart &&
              periodEnd &&
              rangesOverlap(startAt, endAt, periodStart, periodEnd),
          );
        });
  }

  /**
   * Writes a reservation document in a transaction.
   *
   * @param {Transaction} transaction Firestore transaction.
   * @param {DocumentReference} ref Reservation ref.
   * @param {ReservationDoc} reservation Reservation document.
   */
  createReservation(
      transaction: Transaction,
      ref: DocumentReference,
      reservation: ReservationDoc,
  ): void {
    transaction.set(ref, removeUndefinedValues(reservation));
  }

  /**
   * Updates a reservation inside a transaction.
   *
   * @param {Transaction} transaction Firestore transaction.
   * @param {string} reservationId Reservation id.
   * @param {Partial<ReservationDoc>} data Reservation patch.
   */
  updateReservation(
      transaction: Transaction,
      reservationId: string,
      data: Partial<ReservationDoc>,
  ): void {
    transaction.update(
        this.db.collection("reservations").doc(reservationId),
        removeUndefinedValues(data) as FirebaseFirestore.UpdateData<
          FirebaseFirestore.DocumentData
        >,
    );
  }

  /**
   * Builds a reservation document.
   *
   * @param {Partial<ReservationDoc>} data Reservation data.
   * @return {ReservationDoc} Reservation document.
   */
  buildReservationDoc(data: Partial<ReservationDoc>): ReservationDoc {
    const now = Timestamp.now();

    return {
      id: data.id ?? "",
      folio: data.folio ?? "",
      labId: data.labId ?? "",
      labName: data.labName ?? "",
      teacherUid: data.teacherUid ?? "",
      teacherName: data.teacherName ?? "",
      teacherEmail: data.teacherEmail ?? "",
      subject: data.subject ?? "",
      group: data.group ?? "",
      practiceName: data.practiceName ?? "",
      objective: data.objective ?? "",
      materialRequired: data.materialRequired ?? "",
      practiceType: data.practiceType ?? "",
      practiceTypeOther: data.practiceTypeOther,
      risky: data.risky === true,
      externalParticipants: data.externalParticipants === true,
      protocolRequired: data.protocolRequired === true,
      protocolFiles: data.protocolFiles ?? [],
      startAt: data.startAt ?? now,
      endAt: data.endAt ?? now,
      status: data.status as ReservationStatus,
      statusReason: data.statusReason,
      calendarEventId: data.calendarEventId,
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now,
      source: data.source ?? "web",
    };
  }

  /**
   * Returns the typed reservations collection.
   *
   * @return {CollectionReference} Collection reference.
   */
  private reservations(): CollectionReference {
    return this.db.collection("reservations");
  }

  /**
   * Converts a reservation snapshot to model.
   *
   * @param {QueryDocumentSnapshot} document Firestore document.
   * @return {ReservationDoc} Reservation document.
   */
  private toReservationDoc(
      document: QueryDocumentSnapshot,
  ): ReservationDoc {
    return document.data() as ReservationDoc;
  }

  /**
   * Converts stored reservation date values to Date.
   *
   * Some early documents may contain serialized Timestamp internals from a
   * previous sanitizer version. Keep conflict validation resilient while new
   * writes preserve Firestore Timestamp values.
   *
   * @param {unknown} value Stored date value.
   * @return {Date | null} Parsed date.
   */
  toDate(value: unknown): Date | null {
    if (value instanceof Timestamp) {
      return value.toDate();
    }

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (isTimestampLike(value)) {
      return new Timestamp(value._seconds, value._nanoseconds ?? 0).toDate();
    }

    if (isAdminTimestampLike(value)) {
      return new Timestamp(value.seconds, value.nanoseconds ?? 0).toDate();
    }

    return null;
  }
}

/**
 * Checks for legacy serialized Admin Timestamp shape.
 *
 * @param {unknown} value Stored date value.
 * @return {boolean} Whether the value has timestamp internals.
 */
function isTimestampLike(value: unknown): value is {
  _seconds: number;
  _nanoseconds?: number;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as {_seconds?: unknown})._seconds === "number"
  );
}

/**
 * Checks for serialized Firestore Timestamp shape.
 *
 * @param {unknown} value Stored date value.
 * @return {boolean} Whether the value has timestamp fields.
 */
function isAdminTimestampLike(value: unknown): value is {
  seconds: number;
  nanoseconds?: number;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as {seconds?: unknown}).seconds === "number"
  );
}
