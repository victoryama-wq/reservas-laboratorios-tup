Roles oficiales

Solo existirán tres roles:

type UserRole = 'docente' | 'responsable_laboratorio' | 'admin_sistemas';

No se deben crear roles adicionales como admin, sistemas, coordinador o superadmin.

1. Rol docente

Usuario que solicita reservas.

Permisos
Iniciar sesión con correo institucional.
Ver laboratorios activos.
Consultar disponibilidad.
Crear solicitudes de reserva.
Cargar protocolo cuando aplique.
Consultar sus propias reservas.
Consultar estatus de sus solicitudes.
Cancelar reservas propias si la regla institucional lo permite.
Recibir notificaciones.
Restricciones
No puede aprobar solicitudes.
No puede rechazar solicitudes.
No puede editar reglas.
No puede gestionar laboratorios.
No puede ver reportes globales.
No puede modificar usuarios.

2. Rol responsable_laboratorio

Usuario encargado de uno o varios laboratorios.

Permisos
Ver solicitudes de laboratorios asignados.
Ver protocolos adjuntos de sus laboratorios.
Aprobar solicitudes pendientes de sus laboratorios.
Rechazar solicitudes pendientes de sus laboratorios.
Escribir motivo de rechazo.
Ver historial de reservas de sus laboratorios.
Recibir notificaciones.
Crear reservas propias como usuario institucional.
Restricciones
No puede modificar reglas globales.
No puede gestionar usuarios.
No puede editar laboratorios globalmente.
No puede aprobar solicitudes de laboratorios no asignados.
No puede consultar reportes globales salvo que se habilite una vista limitada.

3. Rol admin_sistemas

Administrador general de la web app.

Este rol corresponde al área de sistemas. Puede fungir también como responsable de laboratorio, por ejemplo, para Centro de Cómputo.

Permisos
Acceso total al sistema.
Crear, editar y desactivar laboratorios.
Asignar responsables.
Configurar calendarios.
Configurar horarios.
Configurar reglas especiales.
Configurar anticipación mínima.
Ver todas las reservas.
Aprobar o rechazar cualquier solicitud.
Modificar estados en casos administrativos.
Gestionar usuarios.
Revisar bitácoras.
Consultar reportes.
Atender errores técnicos.
Crear reservas propias.

Modelo de usuario
interface AppUser {
  uid: string;
  displayName: string;
  email: string;
  role: 'docente' | 'responsable_laboratorio' | 'admin_sistemas';
  labsAssigned: string[];
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

Matriz de permisos

| Acción                                 | docente | responsable_laboratorio | admin_sistemas |
| -------------------------------------- | ------: | ----------------------: | -------------: |
| Crear reserva                          |      Sí |                      Sí |             Sí |
| Ver laboratorios activos               |      Sí |                      Sí |             Sí |
| Ver sus reservas                       |      Sí |                      Sí |             Sí |
| Ver reservas de laboratorios asignados |      No |                      Sí |             Sí |
| Ver todas las reservas                 |      No |                      No |             Sí |
| Aprobar solicitudes                    |      No |          Solo asignadas |             Sí |
| Rechazar solicitudes                   |      No |          Solo asignadas |             Sí |
| Gestionar laboratorios                 |      No |                      No |             Sí |
| Gestionar reglas                       |      No |                      No |             Sí |
| Gestionar usuarios                     |      No |                      No |             Sí |
| Ver reportes globales                  |      No |                      No |             Sí |
| Revisar bitácora completa              |      No |                 Parcial |             Sí |

## Actualizacion Fase 16A.1: autoalta docente y prealta administrativa

Los docentes regulares no requieren autorizacion administrativa previa cuando
su correo institucional cumple el patron:

```text
^tup-d\d+@tecplayacar\.edu\.mx$
```

Al iniciar sesion con Google, la Cloud Function `ensureUserProfile` puede crear
automaticamente `users/{uid}` con rol `docente`, `active: true` y
`labsAssigned: []`. El frontend no crea este perfil directamente.

Los responsables de laboratorio y coordinadores no se identifican por ese
patron docente. Admin/Sistemas debe preautorizarlos desde `/admin/usuarios`
mediante `adminPreauthorizeUser`, indicando correo institucional, rol oficial,
estado activo/inactivo y laboratorios asignados cuando el rol sea
`responsable_laboratorio`.

Cuando una cuenta preautorizada inicia sesion por primera vez,
`ensureUserProfile` reclama `preauthorizedUsers/{email}` y crea el perfil real
`users/{uid}` con el UID generado por Firebase Authentication. Ningun usuario
puede asignarse su propio rol, activarse o modificar `labsAssigned` desde
Angular.

## Actualizacion Fase 16F: revocacion y suspension

Admin/Sistemas puede revocar una prealta administrativa no reclamada desde
`/admin/usuarios`. La revocacion no elimina el documento: actualiza
`preauthorizedUsers/{email}` con `active: false`, `revokedBy`, `revokedAt` y
motivo opcional. Una prealta revocada no puede ser reclamada por
`ensureUserProfile`.

Los usuarios que ya existen en `users/{uid}` no se borran fisicamente para
conservar trazabilidad institucional. Si se debe impedir el acceso, el perfil
se suspende mediante `adminUpdateUser` con `active: false`. Las reservas,
bitacoras, notificaciones y auditorias historicas permanecen intactas.
