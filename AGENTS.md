# Lophos Design System Migration

## Fonte de verdade

O arquivo `/design-system/design-system-lophos.json` é a fonte oficial de design system do projeto.

Sempre que criar, refatorar ou ajustar UI, use apenas os tokens definidos nesse arquivo.

## Regras de cor

Não usar hex direto em componentes, páginas ou arquivos de estilo.

Não criar novas cores.

Para identidade visual, usar apenas:
- river-bed
- bitter-lemon

Para estados funcionais, usar apenas:
- atlantis para success
- clementine para warning
- shiraz para danger/error

Usar `semanticColors` para UI.
Usar `palette` apenas como escala-base para tokens semânticos.

Cores antigas devem ser migradas conforme `legacyColorMap`.

## Regras de tipografia

Usar apenas `typography.textStyles`.

Não criar novos tamanhos de fonte, line-heights, letter-spacings ou font-weights fora do design system.

Não usar estilos antigos como:
- h1-36
- body-15.2
- body-14.4
- caption-11.008
- caption-10

Quando encontrar estilos antigos, migrar usando `legacyTypographyMap`.

## Regras de implementação

Preferir CSS variables/tokens globais em vez de valores hardcoded.

Criar ou manter um arquivo central de tokens, por exemplo:
`/src/styles/tokens.css`

Componentes devem usar classes/tokens semânticos, não valores visuais soltos.

Antes de alterar UI, auditar os arquivos afetados e identificar:
- hex codes hardcoded
- classes Tailwind arbitrárias
- font-size hardcoded
- line-height hardcoded
- letter-spacing hardcoded
- cores fora do design system

## Critério de aceite

Ao final de cada alteração:
- não deve haver novos hex codes hardcoded;
- não deve haver novas cores fora do design system;
- não deve haver nova tipografia fora de `typography.textStyles`;
- componentes alterados devem preservar comportamento e layout;
- rodar lint/build/test se existirem.

## Test login

Use environment variables for the test user:

- E2E_BASE_URL
- E2E_USER_EMAIL
- E2E_USER_PASSWORD

The real login smoke test depends on network access from the test browser to the configured Supabase domain used by `VITE_SUPABASE_URL`.

Use `test:e2e:real` for the network-dependent Supabase login smoke test.
Use `test:e2e:ui` for mockado/future UI-only Playwright tests that should not depend on external network.

Never ask for or use production credentials.
Do not commit `.env.local`, `.env.test`, or Playwright auth state files.
