# Animação rigorosa V5

## Problema resolvido

Nas versões anteriores, o 3Dmol inferia ligações a partir de distâncias em arquivos XYZ. Isso podia criar ligações falsas entre água, Na⁺, Cl⁻ e a rede cristalina.

## Solução

A animação agora é desenhada manualmente:

- esferas para Na⁺, Cl⁻, O e H;
- cilindros apenas para ligações O–H dentro da água;
- linhas pontilhadas para interações íon–dipolo;
- sem `addModel()` no filme;
- sem inferência automática de ligações.

## Interpretação

- H–O–H = ligação covalente real dentro da água.
- O···Na⁺ = interação íon–dipolo.
- H···Cl⁻ = interação íon–dipolo.
