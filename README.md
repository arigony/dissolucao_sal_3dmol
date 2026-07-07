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


## V3 — gráficos dinâmicos

Os gráficos foram adicionados antes do quiz, no mesmo enquadramento visual do béquer:

- Massa dissolvida × tempo, com linha de capacidade máxima.
- Solubilidade do NaCl × temperatura, com marcador da temperatura atual.

## V4 — gráfico estável

Correções:
- a curva de massa dissolvida agora mantém o histórico desde 0 s;
- o código não remove mais os pontos iniciais do gráfico;
- o canvas só é redimensionado quando o tamanho real muda, evitando flicker/sumiço;
- altura fixa do canvas para melhorar estabilidade visual.

## V5 — animação molecular rigorosa

Correção principal:
- A animação não usa mais `addModel()` nem `addModelsAsFrames()` para o filme.
- O 3Dmol não infere ligações a partir de XYZ.
- Todos os átomos são desenhados como esferas.
- Somente as ligações O–H da água são desenhadas manualmente com cilindros.
- As interações Na⁺···O e Cl⁻···H são mostradas como linhas pontilhadas.
- A rotação automática fica desligada durante o filme para melhorar a leitura didática.
- O cristal foi reduzido para destacar a superfície ativa.

Motivo:
Arquivos XYZ não têm conectividade química. O visualizador podia inferir ligações falsas entre água, íons e cristal. A V5 elimina essa ambiguidade.
