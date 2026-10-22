# health.hgsportafolio.site

Centro de confianza técnica de [hgsportafolio.site](https://hgsportafolio.site): disponibilidad, rendimiento, seguridad observable y calidad, medidos por comprobaciones automáticas que corren en este repositorio público. Cualquiera puede leer el código que mide, los datos en bruto y los logs de cada medición.

## Qué se mide

| Qué | Cada cuánto | Cómo | Dónde queda |
| :-- | :-- | :-- | :-- |
| Disponibilidad y tiempo de respuesta de la portada, los casos de estudio, la documentación y esta página | Cada 30 minutos | `scripts/check-uptime.mjs`: responde 200 **y** el HTML trae el texto esperado; un fallo se reintenta a los 10 s antes de contar | `data/uptime/<mes>.json` (cada muestra) y `data/status.json` (resumen) |
| Lighthouse móvil y escritorio contra producción | Una vez al día | `scripts/check-daily.mjs`, Lighthouse 12.8.2 (la misma versión que el CI del sitio), mediana de 3 corridas | `data/lighthouse.json` e informes HTML en el artefacto de cada corrida |
| Cabeceras de seguridad, redirección a HTTPS, `security.txt` y certificados | Una vez al día | `scripts/check-daily.mjs`, solo lo que ve un navegador | `data/security.json` |

Una caída abre un issue con la etiqueta `incidente` y se cierra sola cuando la página vuelve a responder: [historial de incidentes](https://github.com/DevCat-HGS/health/issues?q=label%3Aincidente).

## Reglas

- **Nada se marca como aprobado sin medirse.** Lo que no se ha medido dice «No evaluado», y lo viejo, «Desactualizado».
- **No hay una nota única.** Cada indicador muestra su fuente y su fecha por separado.
- **La lista de páginas está fija en el código** (`scripts/targets.mjs`): nadie puede pedirle al monitor que mida otra dirección.
- **No se publica nada que ayude a un ataque:** ni versiones, ni valores completos de cabeceras, ni el panel de administración, que es privado y no se monitorea.

## Límites

Mide desde un solo lugar (los servidores de GitHub Actions) y GitHub puede retrasar las tareas programadas unos minutos. Lighthouse es una prueba de laboratorio, no de usuarios reales. Los controles de seguridad son concretos y limitados: no son una auditoría.

## Por qué en GitHub Pages

El sitio vive en Netlify; esta página, aparte, en GitHub Pages. Si el sitio cae, esta página sigue en pie para contarlo. Se publica con el despliegue de Pages desde Actions (`.github/workflows/deploy.yml`), así que el dominio es un ajuste del repositorio y ningún archivo del build puede borrarlo.

## Correrlo en local

```bash
node scripts/check-uptime.mjs                   # una comprobación (sin token no abre issues)
SKIP_LIGHTHOUSE=1 node scripts/check-daily.mjs  # solo los controles de seguridad
```

---

Technical trust center for hgsportafolio.site: availability, performance, observable security and quality, measured by automated checks that run in this public repository. Nothing is marked as passing without a measurement.
