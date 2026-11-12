# RLS Tools

App móvil (PWA) del almacén, **complemento del ERP HANA4**. Está pensada para celular y pantallas pequeñas: se maneja con el pulgar y con una pistola lectora USB o Bluetooth, y **sigue funcionando sin señal**.

Usa **la misma base de datos del ERP**, con los mismos usuarios, roles, permisos y stock. Por eso un inventario aplicado desde el celular aparece al instante en el kardex y en la contabilidad del ERP, y lo que se da de alta en el ERP (productos, ubicaciones) llega al celular.

## Herramientas

La pantalla de inicio agrupa las herramientas en secciones, como un terminal de tienda: **Inventarios, Ventas, Transferencias, Recibos y Otros**. Arriba aparecen el código del usuario y el número de terminal; abajo, **Configuración** y **Cerrar Sesión**.

| Sección | Herramienta | Qué hace | Permiso del ERP |
|---|---|---|---|
| Inventarios | **Búsqueda de Inventario** | Por código o nombre: stock, precio, ubicación, stock en otras tiendas y lotes por vencer | Inventario: ver |
| | **Inventario Físico** | Sesiones por zona con conteo ciego o completo; al cerrar muestra sobrantes y faltantes, y permite enviar, aplicar o anular | Inventario: ver o crear (aplicar: editar) |
| | **Inventario con Pistola** | +1 por lectura o con cantidad; valida contra el catálogo; cambia de ubicación escaneando su etiqueta | Inventario: crear |
| | **Tiendas** | Resumen de cada tienda (con stock, por reponer, agotados) y stock de un producto en todas | Inventario: ver |
| Ventas | **Nueva Venta** | Cobra desde el celular con la caja abierta del usuario: boleta, factura o ticket; efectivo, tarjeta, Yape o Plin | Ventas: crear y Caja: crear |
| | **Nueva Orden** | Cotización (orden de venta) que el cajero cobra en el ERP; la comisión es del vendedor | Ventas: crear |
| | **Autorizaciones** | Aprueba o rechaza las solicitudes de pedido pendientes de la tienda | Compras: editar |
| Transferencias | **Nueva Transferencia** | La mercadería sale de esta tienda y queda **en tránsito** | Inventario: editar |
| | **Recibir Transferencia** | Escanea lo que llegó; la diferencia se registra como merma o sobrante | Inventario: editar |
| Recibos | **Recibir O/C** | Búsqueda de órdenes de compra (número, proveedor, fecha, estado); verifica escaneando, pide lote y vencimiento cuando corresponde y la recibe en el ERP | Compras: ver e Inventario: editar |
| | **Retorno a Proveedor** | Devuelve mercadería: sale del stock y queda como reclamo (cuenta 1673) hasta la nota de crédito | Inventario: editar y Compras: ver |
| Otros | **Movimientos de Almacén** | Entradas, salidas, transferencias directas y cambios de ubicación | Inventario: editar |
| | **Reportes y Diferencias** | Inventarios realizados, faltantes, sobrantes, diferencia valorizada e historial (CSV) | Inventario: ver |
| | **Sincronización con HANA4** | Señal, operaciones pendientes, rechazadas (con su motivo) e historial | Todos |

Cada rol ve solo las secciones y herramientas que sus permisos del ERP permiten: el Almacenero ve Inventarios, Transferencias y Recibos; el Cajero, Ventas; el Vendedor, Nueva Orden; el Comprador, Autorizaciones y consultas. Quien no tiene ninguna herramienta no entra. Los permisos se gestionan en el ERP (**General → Configuración → Roles y permisos**) y la base de datos los vuelve a exigir en cada operación.

Ventas, órdenes, autorizaciones y recepción de O/C necesitan señal (el ERP valida stock, precio, caja y lotes al momento). Inventarios, movimientos, transferencias y retornos funcionan sin señal mediante la cola.

## Cómo funciona sin señal

- **Catálogo en el celular:** al entrar, se reciben del ERP los productos con su stock, precio, código de barras y ubicación de la sucursal, y se guardan en el teléfono (IndexedDB). Escanear y consultar no necesita conexión.
- **Cola de operaciones:** cada lectura o movimiento se guarda primero en el celular con un **identificador único** y se envía al ERP en orden. Sin señal, espera y se reenvía sola al volver la conexión.
- **Sin duplicados:** el ERP registra cada identificador en su bitácora (`mobile_operations`). Si una operación llega dos veces porque la señal se cortó justo después de enviarla, el ERP devuelve el resultado anterior y no la aplica de nuevo.
- **Errores:** si el ERP rechaza una operación por una regla de negocio (por ejemplo, un inventario ya cerrado o stock insuficiente), queda en **Sincronización** con el motivo, para reintentarla o descartarla.
- **Cierre en orden:** cerrar y aplicar un inventario también pasan por la cola, así nunca se cierra antes de que lleguen los escaneos pendientes.
- **Al cerrar sesión** se borra todo lo guardado en el celular. Si quedan operaciones sin enviar, la app avisa antes.

## Instalación

1. **Base de datos:** ejecuta en Supabase, en orden, las migraciones del ERP `erp/supabase/migrations/0010_rls_tools.sql` (ubicaciones, inventarios y bitácora móvil) y `0011_transferencias_retornos.sql` (transferencias en tránsito y retornos a proveedor). SQL Editor → pegar → Run. Son compatibles con lo que ya funciona.
2. **Variables:** copia `.env.example` como `.env.local` con **los mismos valores del ERP** (URL y clave publicable de Supabase). No necesita la clave de servicio.
3. **Local:** `npm install` y `npm run dev`. Para probar con la cámara del celular hace falta HTTPS (Vercel lo da).
4. **Vercel:** crea un proyecto nuevo con este repositorio y las mismas variables. Instala la app en el celular desde el navegador («Agregar a la pantalla de inicio»).

En el ERP, **MM → Inventario → Ubicaciones de almacén** crea los pasillos y estantes; imprime su código como etiqueta para escanearlo. **MM → Inventario → Inventarios desde RLS Tools** muestra lo contado en el celular y permite aplicarlo. **Almacén → Transferencias entre Tiendas** y **Almacén → Retornos a Proveedor** muestran lo registrado desde el celular.

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
