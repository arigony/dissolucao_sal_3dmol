# Dissolução do NaCl em água — 3Dmol corrigido V2

Versão corrigida após análise da página publicada.

## Correções principais

1. Viewer preso ao card:
   - 3Dmol criado usando o elemento DOM real.
   - CSS reforçado para evitar sobreposição no hero/header.
   - `viewer.resize()` após inicialização e no redimensionamento da janela.

2. Água com ligações O–H visíveis:
   - Estilo padrão didático.
   - Na⁺ e Cl⁻ como esferas.
   - Água em ball-and-stick.

3. Filme multi-frame:
   - Substitui o slideshow de JSON.
   - Usa `models/nacl_hydration_movie.xyz`.
   - Carrega com `addModelsAsFrames(...)` e `viewer.animate(...)`.

## Estrutura

```text
index.html
style.css
script.js
README.md
.nojekyll
models/
  nacl_crystal.xyz
  na_hydrated.xyz
  cl_hydrated.xyz
  hydrated_ions_final.xyz
  nacl_hydration_movie.xyz
docs/
  correcoes_v2.md
```

## Publicação

Substitua os arquivos atuais do repositório pelos arquivos desta pasta.
Mantenha `.nojekyll` na raiz.
