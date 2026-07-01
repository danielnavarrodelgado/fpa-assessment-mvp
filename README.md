# F3M FP&A Assessment MVP

Prototipo local para validar el assessment FP&A basado en el Excel `F3M_FP&A_assessment_v0_26062026.xlsx`.

## Cómo ejecutarlo

1. Abre una terminal en esta carpeta.
2. Lanza un servidor local:

   ```powershell
   python -m http.server 8000
   ```

3. Abre en el navegador:

   ```text
   http://localhost:8000/
   ```

Si `python` no está disponible en tu equipo, puedes usar cualquier servidor estático equivalente. El navegador necesita servir la carpeta para poder leer `data/fpa_assessment.json`.

## Qué permite hacer

- Editar scores de Procesos, Tecnología y Organización para cada subcapacidad.
- Calcular automáticamente score medio, nivel resultante, gap vs objetivo y prioridad.
- Consultar resumen ejecutivo por dominio y por capacidad.
- Ver heatmap por subcapacidad y palanca.
- Revisar roadmap ordenado por prioridad y gap.
- Exportar un escenario en JSON y reimportarlo más adelante.
- Exportar resumen y roadmap en CSV.

## Reglas replicadas del Excel

- Objetivo de madurez fijo: `4 - Optimizado`.
- Score medio: promedio de los scores informados en Procesos, Tecnología y Organización, redondeado a 2 decimales.
- Nivel resultante:
  - `< 1.5`: `1 - Inicial`
  - `< 2.5`: `2 - Estructurado`
  - `< 3.5`: `3 - Estandarizado`
  - `< 4.5`: `4 - Optimizado`
  - `>= 4.5`: `5 - Avanzado/Referente`
- Gap: `max(0, 4 - score medio)`.
- Prioridad:
  - `Alta` si gap `>= 2`
  - `Media` si gap `>= 1`
  - `Baja` si gap `< 1`
- Oleada:
  - `Alta`: `Oleada 1`
  - `Media`: `Oleada 2`
  - `Baja`: `Oleada 3`

Las subcapacidades sin puntuación se muestran como `Pendiente`, sin prioridad ni oleada artificial.

## Notas del MVP

- No se han creado nuevas capacidades, subcapacidades ni iniciativas.
- Las iniciativas sugeridas proceden del Excel y no se generan con IA.
- La app extiende a las 20 subcapacidades la lógica de cálculo que en el Excel inicial solo estaba aplicada completamente a la primera fila de `Assessment`.
