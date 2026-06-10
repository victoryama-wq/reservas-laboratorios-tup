import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

import {LabDoc} from "../shared/models";

type SeedLabDoc = Omit<LabDoc, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

/**
 * Returns the repository seed file path.
 *
 * @return {string} The seed JSON absolute path.
 */
function seedPath(): string {
  return path.resolve(
      __dirname,
      "../../../firebase/seed/labs.seed.json",
  );
}

/**
 * Reads the laboratory seed JSON file.
 *
 * @return {SeedLabDoc[]} The seed laboratory documents.
 */
function readSeedLabs(): SeedLabDoc[] {
  const content = fs.readFileSync(seedPath(), "utf8");
  return JSON.parse(content) as SeedLabDoc[];
}

/**
 * Converts seed dates into Firestore Timestamp values.
 *
 * @param {SeedLabDoc} lab Laboratory seed document.
 * @return {LabDoc} Laboratory document ready for Firestore.
 */
function toFirestoreLab(lab: SeedLabDoc): LabDoc {
  return {
    ...lab,
    createdAt: admin.firestore.Timestamp.fromDate(new Date(lab.createdAt)),
    updatedAt: admin.firestore.Timestamp.fromDate(new Date(lab.updatedAt)),
  };
}

/**
 * Loads initial laboratory documents without deleting existing fields.
 */
async function seedLabs(): Promise<void> {
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId:
        process.env.GCLOUD_PROJECT ??
        process.env.GOOGLE_CLOUD_PROJECT ??
        "reservas-laboratorios-tup",
    });
  }

  const db = admin.firestore();
  const labs = readSeedLabs();
  const batch = db.batch();

  for (const lab of labs) {
    const documentId = lab.id || lab.slug;
    const ref = db.collection("labs").doc(documentId);
    batch.set(ref, toFirestoreLab(lab), {merge: true});
  }

  await batch.commit();
  console.log(`Semilla cargada: ${labs.length} laboratorios.`);
}

void seedLabs().catch((error) => {
  console.error("No fue posible cargar la semilla de laboratorios.", error);
  process.exit(1);
});
