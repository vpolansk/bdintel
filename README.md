# BDIntel

Prototipo web estatico do BDIntel, com login pelo Supabase e dados sincronizados em nuvem.

## Estrutura

- `index.html`: interface principal e carregamento dos assets.
- `src/styles.css`: estilos visuais da interface.
- `src/db.js`: conexao com Supabase Auth, tabela `rocam_items` e cache local de emergencia.
- `src/components.js`: helpers de apresentacao e constantes usadas pela interface.
- `src/app.js`: fluxo da aplicacao, renderizacao, eventos, mapa, modais, importacao e exportacao.

## Como usar

Abra o link publicado pelo GitHub Pages. O app mostra uma tela de login antes de carregar os dados.

Depois do login, os registros sao carregados da tabela `rocam_items`. Ao salvar, editar, excluir ou importar dados, o app sincroniza as alteracoes com o Supabase.

## Seguranca

O site usa apenas a chave publica `anon` do Supabase. A protecao dos dados depende das politicas RLS da tabela `rocam_items`, que limitam select, insert, update e delete ao usuario autenticado.

Nunca publique a chave `service_role` no GitHub Pages.
