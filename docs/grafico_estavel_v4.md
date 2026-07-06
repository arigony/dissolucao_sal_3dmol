# Gráfico estável V4

Problema observado: a curva começava a desaparecer do lado esquerdo porque o histórico era limitado com `simHistory.shift()`.

Correção:
- manter a curva desde 0 s;
- evitar redimensionar o canvas a cada atualização;
- altura fixa do canvas via CSS.
