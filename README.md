# RLS Tools

App móvil (PWA) del almacén, **complemento del ERP HANA4**. Está pensada para celular y pantallas pequeñas: se maneja con el pulgar y con una pistola lectora USB o Bluetooth, y **sigue funcionando sin señal**.

Usa **la misma base de datos del ERP**, con los mismos usuarios, roles, permisos y stock. Por eso un inventario aplicado desde el celular aparece al instante en el kardex y en la contabilidad del ERP, y lo que se da de alta en el ERP (productos, ubicaciones) llega al celular.

## Herramientas

| N.º | Herramienta | Qué hace | Permiso de Inventario |
|---|---|---|---|
| 01 | **Inventario con pistola** | Escaneo de códigos de barras y QR (pistola o cámara), +1 por lectura o con cantidad, validación contra el catálogo, códigos no registrados en rojo (se reportan), cambio de ubicación escaneando su etiqueta | Crear |
| 02 | **Inventario físico** | Sesiones por zona, con **conteo ciego** y **conteo completo**. Compara lo contado contra el stock del ERP al cerrar, muestra sobrantes y faltantes, y permite cerrar, enviar, aplicar o anular | Ver o Crear (aplicar: Editar) |
| 03 | **Consulta rápida** | Por código o nombre: descripción, SKU, stock, precio, unidad y presentación, ubicación, stock en otras sucursales y lotes por vencer | Ver |
| 04 | **Movimientos de almacén** | Entradas, salidas (con motivo), transferencias entre sucursales y cambios de ubicación, validados escaneando | Editar |
| 05 | **Reportes y diferencias** | Inventarios realizados, productos contados, faltantes, sobrantes, diferencia valorizada al costo e historial de operaciones (exportables a CSV) | Ver |
| 06 | **Sincronización con HANA4** | Estado de la señal, operaciones pendientes, las rechazadas por el ERP (con su motivo, para reintentar o descartar), catálogo recibido e historial enviado | Todos |

Cada rol ve solo las herramientas que su permiso de Inventario permite: el Almacenero las ve todas, el Comprador solo consulta y reportes, y el Cajero no entra. Los permisos se gestionan en el ERP (**General → Configuración → Roles y permisos**) y la base de datos los vuelve a exigir en cada operación.

## Cómo funciona sin señal

- **Catálogo en el celular:** al entrar, se reciben del ERP los productos con su stock, precio, código de barras y ubicación de la sucursal, y se guardan en el teléfono (IndexedDB). Escanear y consultar no necesita conexión.
- **Cola de operaciones:** cada lectura o movimiento se guarda primero en el celular con un **identificador único** y se envía al ERP en orden. Sin señal, espera y se reenvía sola al volver la conexión.
- **Sin duplicados:** el ERP registra cada identificador en su bitácora (`mobile_operations`). Si una operación llega dos veces porque la señal se cortó justo después de enviarla, el ERP devuelve el resultado anterior y no la aplica de nuevo.
- **Errores:** si el ERP rechaza una operación por una regla de negocio (por ejemplo, un inventario ya cerrado o stock insuficiente), queda en **Sincronización** con el motivo, para reintentarla o descartarla.
- **Cierre en orden:** cerrar y aplicar un inventario también pasan por la cola, así nunca se cierra antes de que lleguen los escaneos pendientes.
- **Al cerrar sesión** se borra todo lo guardado en el celular. Si quedan operaciones sin enviar, la app avisa antes.

## Instalación

1. **Base de datos:** ejecuta en Supabase la migración del ERP `erp/supabase/migrations/0010_rls_tools.sql` (SQL Editor → pegar → Run). Agrega ubicaciones, sesiones de inventario, la bitácora móvil y sus funciones, y es compatible con lo que ya funciona.
2. **Variables:** copia `.env.example` como `.env.local` con **los mismos valores del ERP** (URL y clave publicable de Supabase). No necesita la clave de servicio.
3. **Local:** `npm install` y `npm run dev`. Para probar con la cámara del celular hace falta HTTPS (Vercel lo da).
4. **Vercel:** crea un proyecto nuevo con este repositorio y las mismas variables. Instala la app en el celular desde el navegador («Agregar a la pantalla de inicio»).

En el ERP, **MM → Inventario → Ubicaciones de almacén** crea los pasillos y estantes; imprime su código como etiqueta para escanearlo. **MM → Inventario → Inventarios desde RLS Tools** muestra lo contado en el celular y permite aplicarlo.

## Estructura

```
src/app/(app)/        Las 6 herramientas (escaneo, inventario, consulta, movimientos, reportes, sincronización)
src/lib/offline/      Catálogo local, cola con idempotencia y reglas de sincronización
src/lib/auth.ts       Perfil, rol y permisos desde el ERP (función app_context)
src/components/       UI con el mismo estilo del ERP (escritorio azul, mosaicos, barra inferior)
public/sw.js          Service worker: pantallas disponibles sin señal
```

## Pruebas

| Comando | Qué verifica |
|---|---|
| `npm run check` | Lint, tipos y las reglas de la cola (orden, reintentos y clasificación de errores) |
| `npm run test:e2e -- <url>` | Recorrido con usuarios temporales de varios roles (qué herramientas ve cada uno) y flujo real en el navegador: abrir inventario, escanear, enviar sin duplicar y anular. Usa la clave de servicio del `.env.local` del ERP y borra todo al terminar |

Las reglas de negocio de la base de datos (conteo, cierre, aplicación por diferencia, idempotencia y permisos) se prueban en la suite del ERP: `erp/tests/db/reglas-negocio.test.mjs`.
