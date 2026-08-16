import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import App from './App.tsx';

// El arranque vive aparte del componente raiz: este archivo toca el DOM y conoce
// #root, mientras que App.tsx no sabe nada de eso. Fusionarlos ademas costaria una
// recarga completa en cada edicion de la UI: un modulo con efecto de arranque y
// sin export de componente no es frontera de Fast Refresh.
//
// Con `jsx: "react-jsx"` el import default de React no hace falta.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
