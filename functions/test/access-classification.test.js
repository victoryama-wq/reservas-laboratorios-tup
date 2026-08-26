const assert = require("node:assert/strict");
const {test} = require("node:test");

const {
  classifyInstitutionalEmail,
} = require("../lib/modules/users/ensure-user-profile.function");

test("classifies the official teacher email pattern", () => {
  assert.equal(
      classifyInstitutionalEmail("tup-d3001@tecplayacar.edu.mx", []),
      "docente",
  );
});

test("denies the official student email pattern", () => {
  assert.equal(
      classifyInstitutionalEmail("tup12345@tecplayacar.edu.mx", []),
      "estudiante",
  );
});

test("classifies a named administrative account", () => {
  assert.equal(
      classifyInstitutionalEmail("nombre.apellido@tecplayacar.edu.mx", []),
      "administrativo",
  );
  assert.equal(
      classifyInstitutionalEmail(
          "nombre.apellido_paterno@tecplayacar.edu.mx",
          [],
      ),
      "administrativo",
  );
});

test("excludes configured operational accounts before pattern matching", () => {
  const email = "servicio.operativo@tecplayacar.edu.mx";
  assert.equal(classifyInstitutionalEmail(email, [email]), "excluded");
});

test("leaves unknown institutional formats pending", () => {
  assert.equal(
      classifyInstitutionalEmail("direccion@tecplayacar.edu.mx", []),
      "pending",
  );
});
