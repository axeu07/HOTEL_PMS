# HOTEL PMS landing page

The public landing page of HOTEL PMS, as a standalone static site (React + Vite + three.js hero).

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # static site in dist/
npm run preview   # serve the production build
```

- Hotel details, rooms, facilities and gallery captions: `src/data/site.ts`
- Page layout and the stay-request form: `src/Landing.tsx`
- 3D hero: `src/features/hero3d/`
- The stay-request form has no backend: it opens the visitor's email app with the details filled in.
