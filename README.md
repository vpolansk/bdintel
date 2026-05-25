# ROCAM INTEL

Protótipo web estático do ROCAM INTEL, refatorado a partir de um arquivo HTML único para uma estrutura mais organizada.

## Estrutura

- `index.html`: marcação principal da interface e carregamento dos assets.
- `src/styles.css`: estilos visuais extraídos do protótipo original.
- `src/db.js`: camada de persistência atual com `localStorage`, isolada para facilitar uma futura troca por banco em nuvem.
- `src/components.js`: helpers de apresentação e constantes usadas pela interface.
- `src/app.js`: fluxo da aplicação, renderização, eventos, mapa, modais, importação e exportação.

## Como executar

Abra o arquivo `index.html` no navegador.

O app continua usando a chave `rocam_intel_v2` no `localStorage`, preservando o comportamento atual de salvar dados localmente no navegador.

## Backup em pasta sincronizada

Além do `localStorage`, o app pode espelhar os dados em um arquivo JSON escolhido pelo usuário.

1. Abra o app em Chrome ou Edge.
2. Clique no botão `☁` no topo.
3. Use `CRIAR ARQUIVO` para criar `rocam-intel-db.json` dentro de uma pasta do OneDrive, iCloud ou Google Drive.
4. Depois de conectado, cada alteração salva no app também grava esse arquivo.
5. Em outro computador, abra o mesmo app, clique em `☁`, escolha `ABRIR EXISTENTE` e selecione o mesmo arquivo sincronizado.
6. Use `CARREGAR DO ARQUIVO` para trazer os dados da nuvem para aquele navegador.

Por segurança, o navegador sempre exige que você escolha ou autorize o arquivo. O app não acessa pastas da nuvem diretamente sem essa permissão.

## Próximos passos sugeridos

Para integrar com banco de dados em nuvem no futuro, comece substituindo as funções de `src/db.js` por chamadas assíncronas a uma API ou SDK, mantendo o restante da interface consumindo a mesma estrutura de dados (`pessoas`, `veiculos` e `locais`).
