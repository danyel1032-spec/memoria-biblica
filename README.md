# Memoria Bíblica

«Guarda la Palabra en tu corazón». Entrenador personal de memorización bíblica: PWA en español, instalable y sin conexión.

## Cómo funciona el motor

- **Aprendizaje guiado** (`src/lib/engine/mastery.ts`, `LADDER`): fragmentos → completar palabras (huecos adaptativos) → elegir la palabra → ordenar → escribir de memoria. Cada paso exige 90 %.
- **Evaluación** (`src/lib/engine/compare.ts`): alineación palabra por palabra; distingue correctas, omitidas, sustituidas, agregadas y fuera de orden. Tildes, mayúsculas, puntuación y erratas de una letra no cuentan como error de memoria.
- **Calendario** (`ts-fsrs`): la calificación sale de la precisión medida. Solo la recuperación sin ayudas (escribir de memoria, recuperación sin pistas) mueve el calendario.
- **Dominio**: 3 recuperaciones sin ayudas con ≥ 95 %, en días distintos y sucesivas, a lo largo de ≥ 21 días. Un fallo < 80 % devuelve el versículo a consolidación.
- **Sesión diaria** (`src/lib/engine/session.ts`): repasos vencidos (los más en riesgo primero), aprendizaje y nuevos intercalados, y repaso acumulativo de versículos antiguos.

## Datos

Todo vive en el dispositivo (IndexedDB con Dexie). Copia de seguridad en Ajustes. La sincronización con Supabase es una fase posterior.

Texto bíblico: Reina-Valera 1909 (dominio público), de `seven1m/open-bibles`, convertido con `npm run build:bible -- <usfx> public/bibles/rv1909.json rv1909 "Reina-Valera 1909"`. Para otra traducción con licencia, añade su JSON y su entrada en `TRANSLATIONS` (`src/lib/bible/loader.ts`).

## Desarrollo

```
npm install
npm run dev        # desarrollo
npm test           # pruebas del motor
npm run build      # exporta a out/ y genera el service worker
```

Netlify: `netlify.toml` ya define `npm run build` y publica `out/`.
