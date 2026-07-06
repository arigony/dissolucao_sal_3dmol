# Correções V2

## Viewer fora do lugar
Foi trocado o uso de string por elemento DOM real:

```js
const viewerEl = document.getElementById("viewer3d");
viewer = $3Dmol.createViewer(viewerEl, {...});
```

## Água sem ligações
O estilo padrão agora exibe água em ball-and-stick.

## Filme
A animação agora usa arquivo XYZ multi-frame:

```js
viewer.addModelsAsFrames(data, "xyz");
viewer.animate({ loop: "forward", interval: 260 });
```

## Limitação
A animação é didática, não uma trajetória real de dinâmica molecular.
